import { create, type StateCreator } from 'zustand';
import type { AnalyzeResponse } from '@/types/api';

interface ResultsState {
  history: AnalyzeResponse[];
  activeResult: AnalyzeResponse | null;
  addResult: (result: AnalyzeResponse) => void;
  setActiveResult: (result: AnalyzeResponse | null) => void;
  clearHistory: () => void;
}

const store: StateCreator<ResultsState> = (set) => ({
  history: [],
  activeResult: null,

  addResult: (result: AnalyzeResponse) =>
    set((state: ResultsState) => ({
      history: [result, ...state.history],
      activeResult: result,
    })),

  setActiveResult: (result: AnalyzeResponse | null) => set({ activeResult: result }),
  clearHistory: () => set({ history: [], activeResult: null }),
});

export const useResultsStore = create<ResultsState>(store);
