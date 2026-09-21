import type { AnalyzeResponse } from '@/types/api';

/** Мок-ответы backend для разработки UI, пока API не готов (см. советы в плане).
 *  Переключается флагом VITE_USE_MOCKS=true в .env */
export const mockAnalyzeResponse: AnalyzeResponse = {
  study_uid: '1.2.840.113619.2.55.mock.study.001',
  path_to_study: '/data/study_001.dcm',
  time_of_processing: 4.82,
  images: [
    {
      image_uid: '1.2.840.113619.2.55.mock.image.001',
      anatomical_region: 'lumbar_spine',
      quality_class: 1,
      violation_type: ['axis_tilt', 'foreign_object'],
      confidence: [0.91, 0.77],
      preview_url: 'https://placehold.co/512x640/1a1a2e/eee?text=L-Spine+DICOM',
      processing_status: 'Success',
      time_of_processing: 2.41,
      visualization: {
        axis_angle_deg: 6.9,
        axis_line: [
          { x: 256, y: 40 },
          { x: 300, y: 600 },
        ],
        bboxes: [{ x: 40, y: 30, width: 90, height: 60, label: 'Посторонний предмет' }],
      },
    },
    {
      image_uid: '1.2.840.113619.2.55.mock.image.002',
      anatomical_region: 'hip',
      quality_class: 0,
      violation_type: [],
      confidence: [],
      preview_url: 'https://placehold.co/512x640/16213e/eee?text=Hip+DICOM',
      processing_status: 'Success',
      time_of_processing: 2.41,
    },
  ],
};

export const mockResultsHistory: AnalyzeResponse[] = [
  mockAnalyzeResponse,
  {
    study_uid: '1.2.840.113619.2.55.mock.study.002',
    path_to_study: '/data/study_002.dcm',
    time_of_processing: 3.1,
    images: [
      {
        image_uid: '1.2.840.113619.2.55.mock.image.003',
        anatomical_region: 'hip',
        quality_class: 1,
        violation_type: ['limb_rotation'],
        confidence: [0.83],
        preview_url: 'https://placehold.co/512x640/0f3460/eee?text=Hip+Rotated',
        processing_status: 'Success',
        time_of_processing: 3.1,
      },
    ],
  },
];

export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';
