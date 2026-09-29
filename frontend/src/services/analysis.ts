import { getErrorMessage } from '@/api/client';
import { fetchVisual, predictBatch, predictSingle } from '@/api/predict';
import { baseName, createId } from '@/lib/files';
import { matchArchiveFiles, readArchive } from '@/lib/archive';
import { createPreview } from '@/lib/preview';
import { useResultsStore } from '@/stores/results';
import type { PredictionResult } from '@/types/api';
import type { DicomPreview, RecordSource, StudyRecord } from '@/types/study';

function studyKeyFor(result: PredictionResult, preview: DicomPreview | null, id: string): string {
  const uid = preview?.studyUid || result.study_uid;
  return uid && !/^stub/i.test(uid) ? uid : id;
}

function buildRecord(
  result: PredictionResult,
  fallbackName: string,
  source: RecordSource,
  preview: DicomPreview | null,
  receivedAt: number,
): StudyRecord {
  const id = createId();
  return {
    id,
    studyKey: studyKeyFor(result, preview, id),
    fileName: result.path_to_study ? baseName(result.path_to_study) : fallbackName,
    source,
    receivedAt,
    result,
    preview,
  };
}

export async function analyzeDicomFile(
  file: File,
  source: Exclude<RecordSource, 'batch'>,
  onProgress?: (percent: number) => void,
): Promise<StudyRecord[]> {
  const previewTask = createPreview(file).catch(() => null);
  const results = await predictSingle(file, onProgress);
  const preview = await previewTask;
  const receivedAt = Date.now();

  const records = results.map((result) => ({
    ...buildRecord(result, file.name, source, preview, receivedAt),
    file,
  }));
  useResultsStore.getState().addRecords(records, source === 'single');
  return records;
}

export interface BatchSummary {
  total: number;
  passed: number;
  failed: number;
  report: Blob;
}

export async function analyzeArchive(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<BatchSummary> {
  const archiveTask = readArchive(file).catch(() => []);
  const { results, report } = await predictBatch(file, onProgress);
  const files = matchArchiveFiles(results, await archiveTask);
  const receivedAt = Date.now();

  const records = results.map((result, index) => {
    const record = buildRecord(result, `file_${index + 1}.dcm`, 'batch', null, receivedAt + index);
    const archived = files[index];
    return archived ? { ...record, file: archived } : record;
  });
  useResultsStore.getState().addRecords(records, false);

  const failed = results.filter(
    (r) => r.quality_class === 1 || r.processing_status.toLowerCase() !== 'success',
  ).length;

  return { total: results.length, passed: results.length - failed, failed, report };
}

export function needsVisual(record: StudyRecord): boolean {
  return (
    Boolean(record.file) &&
    record.result.quality_class === 1 &&
    record.result.processing_status.toLowerCase() === 'success'
  );
}

export async function loadVisual(record: StudyRecord): Promise<void> {
  const store = useResultsStore.getState();
  if (!record.file || !store.visualsSupported || store.visuals[record.id]) return;

  store.setVisual(record.id, { status: 'loading' });
  try {
    const response = await fetchVisual(record.file);
    if (response.kind === 'unsupported') {
      useResultsStore.getState().disableVisuals();
      useResultsStore.getState().setVisual(record.id, { status: 'none' });
      return;
    }
    useResultsStore
      .getState()
      .setVisual(
        record.id,
        response.kind === 'image'
          ? { status: 'ready', url: URL.createObjectURL(response.blob) }
          : { status: 'none' },
      );
  } catch (error) {
    useResultsStore.getState().setVisual(record.id, { status: 'error', message: getErrorMessage(error) });
  }
}

const previewsInFlight = new Set<string>();

export async function loadPreview(record: StudyRecord): Promise<void> {
  if (!record.file || record.preview || previewsInFlight.has(record.id)) return;
  previewsInFlight.add(record.id);
  try {
    const preview = await createPreview(record.file);
    useResultsStore.getState().setPreview(record.id, preview);
  } finally {
    previewsInFlight.delete(record.id);
  }
}
