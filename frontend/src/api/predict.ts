import axios, { type AxiosProgressEvent } from 'axios';
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

export async function predictBatchArchive(file: File): Promise<Blob> {
  const response = await apiClient.post<Blob>('/predict/batch/archive', toForm(file), {
    responseType: 'blob',
  });
  return response.data;
}

export type VisualResponse = { kind: 'image'; blob: Blob } | { kind: 'none' } | { kind: 'unsupported' };

export async function fetchVisual(file: File): Promise<VisualResponse> {
  try {
    const response = await apiClient.post<Blob>('/predict/visual', toForm(file), {
      responseType: 'blob',
      validateStatus: (status) => status === 200 || status === 204,
    });
    if (response.status === 204 || !response.data || response.data.size === 0) {
      return { kind: 'none' };
    }
    return { kind: 'image', blob: response.data };
  } catch (error) {
    if (axios.isAxiosError(error) && (error.response?.status === 404 || error.response?.status === 405)) {
      return { kind: 'unsupported' };
    }
    throw error;
  }
}

export interface HealthInfo {
  online: boolean;
  dummy: boolean;
}

export async function checkHealth(): Promise<HealthInfo> {
  try {
    const { data } = await apiClient.get<{ model?: { dummy?: boolean } }>('/health', {
      timeout: 5000,
    });
    return { online: true, dummy: Boolean(data?.model?.dummy) };
  } catch {
    return { online: false, dummy: false };
  }
}
