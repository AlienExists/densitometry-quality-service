import type { AxiosProgressEvent } from 'axios';
import { apiClient } from './client';
import { parseReport } from './report';
import type { PredictionResult } from '@/types/api';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

type ProgressCallback = (percent: number) => void;

function trackUpload(onProgress?: ProgressCallback) {
  return (event: AxiosProgressEvent) => {
    if (onProgress && event.total) {
      onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    }
  };
}

function toForm(file: File): FormData {
  const form = new FormData();
  form.append('file', file);
  return form;
}

export async function predictSingle(
  file: File,
  onProgress?: ProgressCallback,
): Promise<PredictionResult[]> {
  const response = await apiClient.post<ArrayBuffer>('/predict', toForm(file), {
    responseType: 'arraybuffer',
    onUploadProgress: trackUpload(onProgress),
  });

  const results = parseReport(response.data);
  if (results.length === 0) {
    throw new Error('Сервер вернул пустой отчёт.');
  }
  return results;
}

export interface BatchResponse {
  results: PredictionResult[];
  report: Blob;
}

export async function predictBatch(
  file: File,
  onProgress?: ProgressCallback,
): Promise<BatchResponse> {
  const response = await apiClient.post<ArrayBuffer>('/predict/batch', toForm(file), {
    responseType: 'arraybuffer',
    onUploadProgress: trackUpload(onProgress),
  });

  return {
    results: parseReport(response.data),
    report: new Blob([response.data], { type: XLSX_MIME }),
  };
}

export async function checkHealth(): Promise<boolean> {
  try {
    await apiClient.get('/health', { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}
