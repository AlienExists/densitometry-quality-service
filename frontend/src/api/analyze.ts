import { apiClient } from './client';
import type { AnalyzeResponse, HealthResponse } from '@/types/api';
import type { AxiosProgressEvent } from 'axios';

/**
 * POST /predict — один DICOM-файл → JSON
 */
export async function analyzeSingle(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<AnalyzeResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiClient.post<AnalyzeResponse>('/predict', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (evt: AxiosProgressEvent) => {
      if (onProgress && evt.total) {
        onProgress(Math.round((evt.loaded / evt.total) * 100));
      }
    },
  });

  return response.data;
}

/**
 * POST /predict/batch — ZIP-архив → скачивает xlsx
 */
export async function analyzeBatch(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<void> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiClient.post('/predict/batch', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    responseType: 'blob',
    onUploadProgress: (evt: AxiosProgressEvent) => {
      if (onProgress && evt.total) {
        onProgress(Math.round((evt.loaded / evt.total) * 100));
      }
    },
  });

  // Скачиваем xlsx автоматически
  const url = URL.createObjectURL(new Blob([response.data as BlobPart]));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'results.xlsx';
  link.click();
  URL.revokeObjectURL(url);
}

/** GET /health */
export async function checkHealth(): Promise<HealthResponse> {
  const response = await apiClient.get<HealthResponse>('/health', { timeout: 5000 });
  return response.data;
}
