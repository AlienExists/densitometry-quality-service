import { predictBatch, predictSingle } from '@/api/predict';
import { baseName, createId } from '@/lib/files';
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

  const records = results.map((result) =>
    buildRecord(result, file.name, source, preview, receivedAt),
  );
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
  const { results, report } = await predictBatch(file, onProgress);
  const receivedAt = Date.now();

  const records = results.map((result, index) =>
    buildRecord(result, `file_${index + 1}.dcm`, 'batch', null, receivedAt + index),
  );
  useResultsStore.getState().addRecords(records, false);

  const failed = results.filter(
    (r) => r.quality_class === 1 || r.processing_status.toLowerCase() !== 'success',
  ).length;

  return { total: results.length, passed: results.length - failed, failed, report };
}
