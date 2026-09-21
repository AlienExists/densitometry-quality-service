import { apiClient } from './client';
import type { AnalyzeResponse, BatchStatusResponse, HealthResponse } from '@/types/api';

/** POST /analyze — одно DICOM-исследование (раздел 2.6 ТЗ, п.2) */
export async function analyzeSingle(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<AnalyzeResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiClient.post<AnalyzeResponse>('/analyze', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (evt) => {
      if (onProgress && evt.total) {
        onProgress(Math.round((evt.loaded / evt.total) * 100));
      }
    },
  });
  return response.data;
}

/** POST /batch — ZIP-архив с несколькими исследованиями */
export async function analyzeBatch(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<{ job_id: string }> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiClient.post<{ job_id: string }>('/batch', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (evt) => {
      if (onProgress && evt.total) {
        onProgress(Math.round((evt.loaded / evt.total) * 100));
      }
    },
  });
  return response.data;
}

/** GET /batch/{job_id}/status — прогресс батча, используем для polling */
export async function getBatchStatus(jobId: string): Promise<BatchStatusResponse> {
  const response = await apiClient.get<BatchStatusResponse>(`/batch/${jobId}/status`);
  return response.data;
}

/** Хелпер: опрашивает статус батча раз в intervalMs, пока не завершится или не отменят */
export function pollBatchStatus(
  jobId: string,
  onUpdate: (status: BatchStatusResponse) => void,
  onError: (error: unknown) => void,
  intervalMs = 2000,
): () => void {
  let cancelled = false;

  const tick = async () => {
    if (cancelled) return;
    try {
      const status = await getBatchStatus(jobId);
      if (cancelled) return;
      onUpdate(status);
      if (status.status === 'pending' || status.status === 'processing') {
        setTimeout(tick, intervalMs);
      }
    } catch (err) {
      if (!cancelled) onError(err);
    }
  };

  tick();

  // возвращаем функцию отмены — вызывается по кнопке "Отменить"
  return () => {
    cancelled = true;
  };
}

/** GET /health — индикатор "сервер жив" в шапке */
export async function checkHealth(): Promise<HealthResponse> {
  const response = await apiClient.get<HealthResponse>('/health', { timeout: 5000 });
  return response.data;
}
