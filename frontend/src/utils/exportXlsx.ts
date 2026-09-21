import * as XLSX from 'xlsx';
import type { AnalyzeResponse, ResultRow } from '@/types/api';
import { violationLabel } from './violationLabels';

/** Превращает историю исследований в плоские строки — структура из раздела 2.5 ТЗ */
export function toResultRows(history: AnalyzeResponse[]): ResultRow[] {
  const rows: ResultRow[] = [];
  for (const study of history) {
    for (const image of study.images) {
      rows.push({
        path_to_study: study.path_to_study ?? study.study_uid,
        study_uid: study.study_uid,
        image_uid: image.image_uid,
        anatomical_region: image.anatomical_region,
        quality_class: image.quality_class,
        violation_type: image.violation_type.map(violationLabel).join('; '),
        processing_status: image.processing_status,
        time_of_processing: image.time_of_processing,
      });
    }
  }
  return rows;
}

/**
 * Клиентский экспорт в XLSX — полезно как кнопка "Скачать JSON/XLSX для
 * отладки" (раздел 2.5, 2.6 ТЗ). Финальный официальный отчёт всё равно
 * должен формироваться backend'ом (раздел 2.5 ТЗ — "решение должно
 * формировать итоговый файл"), но эта кнопка нужна для локальной проверки
 * данных на фронте и как fallback на демо.
 */
export function exportResultsToXlsx(history: AnalyzeResponse[], filename = 'qc_results.xlsx') {
  const rows = toResultRows(history);
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Результаты');
  XLSX.writeFile(workbook, filename);
}

export function exportResultsToJson(history: AnalyzeResponse[], filename = 'qc_results.json') {
  const blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
