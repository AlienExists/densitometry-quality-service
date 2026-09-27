import { create } from 'zustand';
import type { StudyRecord } from '@/types/study';

interface ResultsState {
  records: StudyRecord[];
  activeRecordId: string | null;
  addRecords: (records: StudyRecord[], activate: boolean) => void;
  openRecord: (id: string) => void;
}

export const useResultsStore = create<ResultsState>()((set) => ({
  records: [],
  activeRecordId: null,

  addRecords: (records, activate) =>
    set((state) => ({
      records: [...records, ...state.records],
      activeRecordId: activate && records[0] ? records[0].id : state.activeRecordId,
    })),

  openRecord: (id) => set({ activeRecordId: id }),
}));
