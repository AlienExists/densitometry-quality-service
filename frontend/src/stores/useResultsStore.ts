import { create } from 'zustand';
import type { AnalyzeResponse, ImageResult } from '@/types/api';

interface ResultsState {
  /** Все проанализированные исследования за сессию (для таблицы/экспорта) */
  history: AnalyzeResponse[];
  /** Текущее исследование, открытое во вьюере */
  activeStudy: AnalyzeResponse | null;
  /** Текущее изображение внутри исследования (до 3, раздел 2.4 ТЗ) */
  activeImageIndex: number;

  addResult: (result: AnalyzeResponse) => void;
  setActiveStudy: (study: AnalyzeResponse | null) => void;
  setActiveImageIndex: (index: number) => void;
  clearHistory: () => void;
}

export const useResultsStore = create<ResultsState>((set) => ({
  history: [],
  activeStudy: null,
  activeImageIndex: 0,

  addResult: (result) =>
    set((state) => ({
      history: [result, ...state.history],
      activeStudy: result,
      activeImageIndex: 0,
    })),

  setActiveStudy: (study) => set({ activeStudy: study, activeImageIndex: 0 }),
  setActiveImageIndex: (index) => set({ activeImageIndex: index }),
  clearHistory: () => set({ history: [], activeStudy: null, activeImageIndex: 0 }),
}));

/** Хелпер: текущая активная картинка исследования */
export function getActiveImage(): ImageResult | null {
  const { activeStudy, activeImageIndex } = useResultsStore.getState();
  return activeStudy?.images[activeImageIndex] ?? null;
}
