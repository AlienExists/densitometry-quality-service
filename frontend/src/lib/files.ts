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
    .map(({ result }) => [
      result.path_to_study,
      result.study_uid,
      result.image_uid,
      result.anatomical_region,
      result.quality_class,
      result.violation_type ?? '',
      result.processing_status,
      Number(result.time_of_processing.toFixed(4)),
    ]);

  const sheet = XLSX.utils.aoa_to_sheet([[...REPORT_COLUMNS], ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Results');
  XLSX.writeFile(workbook, fileName);
}
