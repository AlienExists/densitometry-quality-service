import { create } from 'zustand';

export type UploadStage = 'idle' | 'uploading' | 'processing' | 'done' | 'error';

interface UploadState {
  stage: UploadStage;
  progress: number; // 0-100
  errorMessage: string | null;
  setStage: (stage: UploadStage) => void;
  setProgress: (progress: number) => void;
  setError: (message: string | null) => void;
  reset: () => void;
}

export const useUploadStore = create<UploadState>((set) => ({
  stage: 'idle',
  progress: 0,
  errorMessage: null,
  setStage: (stage) => set({ stage }),
  setProgress: (progress) => set({ progress }),
  setError: (message) => set({ errorMessage: message, stage: message ? 'error' : 'idle' }),
  reset: () => set({ stage: 'idle', progress: 0, errorMessage: null }),
}));
