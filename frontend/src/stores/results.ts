import { create } from 'zustand';
import type { DicomPreview, StudyRecord, VisualState } from '@/types/study';

interface ResultsState {
  records: StudyRecord[];
  activeRecordId: string | null;
  visuals: Record<string, VisualState>;
  visualsSupported: boolean;
  addRecords: (records: StudyRecord[], activate: boolean) => void;
  openRecord: (id: string) => void;
  setVisual: (id: string, state: VisualState) => void;
  setPreview: (id: string, preview: DicomPreview) => void;
  disableVisuals: () => void;
}

export const useResultsStore = create<ResultsState>()((set) => ({
  records: [],
  activeRecordId: null,
  visuals: {},
  visualsSupported: true,

  addRecords: (records, activate) =>
    set((state) => ({
      records: [...records, ...state.records],
      activeRecordId: activate && records[0] ? records[0].id : state.activeRecordId,
    })),

  openRecord: (id) => set({ activeRecordId: id }),

  setVisual: (id, visual) => set((state) => ({ visuals: { ...state.visuals, [id]: visual } })),

  disableVisuals: () => set({ visualsSupported: false }),

  setPreview: (id, preview) =>
    set((state) => ({
      records: state.records.map((record) => (record.id === id ? { ...record, preview } : record)),
    })),
}));
