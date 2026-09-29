export type AnatomicalRegion = 'lumbar_spine' | 'proximal_femur' | 'unknown';

export interface PredictionResult {
  path_to_study: string;
  study_uid: string;
  image_uid: string;
  anatomical_region: string;
  quality_class: number;
  quality_prob: number | null;
  violation_type: string | null;
  processing_status: string;
  time_of_processing: number;
}

export const REPORT_COLUMNS = [
  'path_to_study',
  'study_uid',
  'image_uid',
  'anatomical_region',
  'quality_class',
  'quality_prob',
  'violation_type',
  'processing_status',
  'time_of_processing',
] as const;
