import type { AnalyzeResponse } from '@/types/api';

export const mockAnalyzeResponse: AnalyzeResponse = {
  path_to_study: '/data/study_001.dcm',
  study_uid: '1.2.840.113619.2.55.mock.study.001',
  image_uid: '1.2.840.113619.2.55.mock.image.001',
  anatomical_region: 'lumbar_spine',
  quality_class: 1,
  violation_type: 'spine_tilt, artifacts',
  processing_status: 'Success',
  time_of_processing: 4.82,
};

export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';
