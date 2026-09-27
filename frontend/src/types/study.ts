import type { PredictionResult } from './api';

export type RecordSource = 'single' | 'batch' | 'monitor';

export interface DicomPreview {
  studyUid?: string;
  sopUid?: string;
  url?: string;
  width?: number;
  height?: number;
  error?: string;
}

export interface StudyRecord {
  id: string;
  studyKey: string;
  fileName: string;
  source: RecordSource;
  receivedAt: number;
  result: PredictionResult;
  preview: DicomPreview | null;
}
