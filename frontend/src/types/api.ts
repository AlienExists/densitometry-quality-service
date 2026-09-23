// ============================================================================
// Контракт с backend — адаптирован под POST /predict и POST /predict/batch
// Менять только здесь, остальной код не трогаем.
// ============================================================================

export type AnatomicalRegion = 'lumbar_spine' | 'proximal_femur' | 'unknown';

export type ViolationType =
  | 'wrong_positioning'       // некорректная укладка (поясничный)
  | 'spine_tilt'              // наклон оси > 5° (поясничный)
  | 'artifacts'               // металлические артефакты (поясничный)
  | 'wrong_hip_positioning'   // неверное позиционирование (бедро)
  | 'rotation_error'          // ротация конечности (бедро)
  | 'roi_error'               // некорректная ROI (бедро)
  | string;                   // на случай новых типов от ML

/** Ответ на POST /predict — одно изображение */
export interface AnalyzeResponse {
  path_to_study: string;
  study_uid: string;
  image_uid: string;
  anatomical_region: AnatomicalRegion;
  quality_class: 0 | 1;           // 0 — норма, 1 — нарушение
  violation_type: string | null;   // строка через запятую или null
  processing_status: 'Success' | 'Failure';
  time_of_processing: number;
}

/** Ответ на POST /predict/batch — скачивается как xlsx, статус только через HTTP */
export interface BatchDownloadResponse {
  ok: boolean;
}

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'down';
}

/** Для таблицы истории результатов */
export interface ResultRow {
  path_to_study: string;
  study_uid: string;
  image_uid: string;
  anatomical_region: AnatomicalRegion;
  quality_class: 0 | 1;
  violation_type: string;
  processing_status: 'Success' | 'Failure';
  time_of_processing: number;
}
