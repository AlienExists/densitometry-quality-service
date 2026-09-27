import * as XLSX from 'xlsx';
import type { PredictionResult } from '@/types/api';

type Row = Record<string, unknown>;

const text = (value: unknown): string =>
  value === null || value === undefined ? '' : String(value).trim();

const toNumber = (value: unknown): number => {
  const n = typeof value === 'number' ? value : parseFloat(text(value).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

function toResult(row: Row): PredictionResult {
  const violation = text(row.violation_type);

  return {
    path_to_study: text(row.path_to_study),
    study_uid: text(row.study_uid),
    image_uid: text(row.image_uid),
    anatomical_region: text(row.anatomical_region) || 'unknown',
    quality_class: toNumber(row.quality_class) >= 1 ? 1 : 0,
    violation_type: violation || null,
    processing_status: text(row.processing_status) || 'Success',
    time_of_processing: toNumber(row.time_of_processing),
  };
}

export function parseReport(data: ArrayBuffer): PredictionResult[] {
  const workbook = XLSX.read(data, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];

  const rows = XLSX.utils.sheet_to_json<Row>(sheet, { defval: '' });
  return rows.map(toResult);
}
