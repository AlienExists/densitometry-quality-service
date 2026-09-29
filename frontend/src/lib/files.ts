import * as XLSX from 'xlsx';
import { REPORT_COLUMNS } from '@/types/api';
import type { StudyRecord } from '@/types/study';

let counter = 0;

export function createId(): string {
  counter += 1;
  return `${Date.now().toString(36)}-${counter}-${Math.random().toString(36).slice(2, 8)}`;
}

export function baseName(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

export function hasExtension(file: File, extension: string): boolean {
  return file.name.toLowerCase().endsWith(extension);
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadReport(records: StudyRecord[], fileName = 'results.xlsx'): void {
  const rows = [...records]
    .sort((a, b) => a.receivedAt - b.receivedAt)
    .map(({ result }) => {
      const failed = result.processing_status.toLowerCase() !== 'success';
      const values: Record<(typeof REPORT_COLUMNS)[number], string | number> = {
        path_to_study: result.path_to_study,
        study_uid: result.study_uid,
        image_uid: result.image_uid,
        anatomical_region: result.anatomical_region,
        quality_class: failed ? '' : result.quality_class,
        quality_prob: result.quality_prob ?? '',
        violation_type: result.violation_type ?? '',
        processing_status: result.processing_status,
        time_of_processing: Number(result.time_of_processing.toFixed(3)),
      };
      return REPORT_COLUMNS.map((column) => values[column]);
    });

  const sheet = XLSX.utils.aoa_to_sheet([[...REPORT_COLUMNS], ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Results');
  XLSX.writeFile(workbook, fileName);
}
