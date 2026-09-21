// ============================================================================
// Контракт с backend. Согласовать с Участником 5 (API) — раздел 2.5, 2.6 ТЗ.
// Если backend отдаёт поля с другими именами — правим только этот файл,
// остальной код не трогаем.
// ============================================================================

export type AnatomicalRegion = 'lumbar_spine' | 'hip' | 'unknown';

/** Тип нарушения — строки должны совпадать с тем, что реально шлёт ML/backend.
 *  Значения ниже — из раздела 2.3 ТЗ, скорректировать после согласования. */
export type ViolationType =
  | 'incorrect_positioning' // некорректная укладка
  | 'axis_tilt' // наклон оси > 5°
  | 'foreign_object' // посторонние предметы / артефакты
  | 'incorrect_roi' // некорректная ROI
  | 'limb_rotation' // ротация конечности
  | string; // на случай новых типов от ML — не ломаем UI

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
}

export interface Keypoint {
  x: number;
  y: number;
  label?: string;
}

/** Доп. визуализация нарушений — раздел 2.6 ТЗ (опционально, если ML отдаёт) */
export interface Visualization {
  bboxes?: BoundingBox[];
  keypoints?: Keypoint[];
  mask_url?: string;
  heatmap_url?: string;
  /** Угол наклона оси позвоночника в градусах, см. рис.2 ТЗ */
  axis_angle_deg?: number;
  /** Точки линии оси, если есть — для отрисовки поверх снимка */
  axis_line?: [Keypoint, Keypoint];
}

export interface ImageResult {
  image_uid: string;
  anatomical_region: AnatomicalRegion;
  /** 0 — качественное, 1 — есть нарушение (раздел 2.5 ТЗ) */
  quality_class: 0 | 1;
  violation_type: ViolationType[];
  /** Параллельный массив к violation_type: confidence[i] относится к violation_type[i] */
  confidence: number[];
  preview_url: string;
  processing_status: 'Success' | 'Failure';
  time_of_processing: number;
  visualization?: Visualization;
}

export interface AnalyzeResponse {
  study_uid: string;
  path_to_study?: string;
  images: ImageResult[];
  time_of_processing: number;
}

export type BatchJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface BatchStatusResponse {
  job_id: string;
  status: BatchJobStatus;
  total: number;
  processed: number;
  results?: AnalyzeResponse[];
  error?: string;
}

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'down';
}

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
