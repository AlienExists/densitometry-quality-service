import { create } from 'zustand';

interface HealthState {
  online: boolean;
  setOnline: (online: boolean) => void;
}

/** Статус "сервер жив" — раздел 2.7 ТЗ (индикатор offline) */
export const useHealthStore = create<HealthState>((set) => ({
  online: true,
  setOnline: (online) => set({ online }),
}));
