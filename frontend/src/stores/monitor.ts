import { create } from 'zustand';
import { getErrorMessage } from '@/api/client';
import { analyzeDicomFile } from '@/services/analysis';

interface FileEntryHandle {
  kind: 'file';
  name: string;
  getFile: () => Promise<File>;
}

interface DirectoryHandle {
  kind: 'directory';
  name: string;
  values: () => AsyncIterable<FileEntryHandle | DirectoryHandle>;
}

type PickerWindow = Window & {
  showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<DirectoryHandle>;
};

export type MonitorFileStatus = 'waiting' | 'processing' | 'done' | 'error';

export interface MonitorFile {
  name: string;
  status: MonitorFileStatus;
  detectedAt: number;
  message?: string;
  recordId?: string;
}

interface MonitorState {
  supported: boolean;
  folderName: string | null;
  autoProcess: boolean;
  files: MonitorFile[];
  error: string | null;
  chooseFolder: () => Promise<void>;
  setAutoProcess: (value: boolean) => void;
  stop: () => void;
}

const POLL_INTERVAL_MS = 3000;
const MAX_VISIBLE_FILES = 50;

let directory: DirectoryHandle | null = null;
let timer: number | null = null;
let scanning = false;
let processing = false;
const known = new Set<string>();
const pendingSizes = new Map<string, number>();
const handles = new Map<string, FileEntryHandle>();

const isDicom = (name: string) => name.toLowerCase().endsWith('.dcm');

function pickerWindow(): PickerWindow | null {
  return typeof window === 'undefined' ? null : (window as PickerWindow);
}

export const useMonitorStore = create<MonitorState>()((set, get) => {
  const updateFile = (name: string, patch: Partial<MonitorFile>) =>
    set((state) => ({
      files: state.files.map((file) => (file.name === name ? { ...file, ...patch } : file)),
    }));

  const processQueue = async () => {
    if (processing) return;
    processing = true;

    try {
      for (;;) {
        const { autoProcess, files } = get();
        if (!autoProcess) break;

        const next = [...files].reverse().find((file) => file.status === 'waiting');
        if (!next) break;

        updateFile(next.name, { status: 'processing', message: undefined });
        try {
          const entry = handles.get(next.name);
          if (!entry) throw new Error('Файл больше недоступен в папке.');
          const records = await analyzeDicomFile(await entry.getFile(), 'monitor');
          updateFile(next.name, { status: 'done', recordId: records[0]?.id });
        } catch (error) {
          updateFile(next.name, { status: 'error', message: getErrorMessage(error) });
        }
      }
    } finally {
      processing = false;
    }
  };

  const rememberExisting = async (handle: DirectoryHandle) => {
    for await (const entry of handle.values()) {
      if (entry.kind === 'file' && isDicom(entry.name)) known.add(entry.name);
    }
  };

  const scan = async () => {
    const handle = directory;
    if (!handle || scanning) return;
    scanning = true;

    try {
      const detected: string[] = [];

      for await (const entry of handle.values()) {
        if (entry.kind !== 'file' || !isDicom(entry.name) || known.has(entry.name)) continue;

        const { size } = await entry.getFile();
        if (size > 0 && pendingSizes.get(entry.name) === size) {
          pendingSizes.delete(entry.name);
          known.add(entry.name);
          handles.set(entry.name, entry);
          detected.push(entry.name);
        } else {
          pendingSizes.set(entry.name, size);
        }
      }

      if (handle !== directory) return;

      if (detected.length > 0) {
        const now = Date.now();
        set((state) => ({
          error: null,
          files: [
            ...detected.map((name) => ({ name, status: 'waiting' as const, detectedAt: now })),
            ...state.files,
          ].slice(0, MAX_VISIBLE_FILES),
        }));
      }
    } catch {
      if (handle === directory) {
        set({ error: 'Нет доступа к папке. Выберите её заново.' });
      }
    } finally {
      scanning = false;
    }

    void processQueue();
  };

  const stopTimer = () => {
    if (timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
  };

  return {
    supported: Boolean(pickerWindow()?.showDirectoryPicker),
    folderName: null,
    autoProcess: true,
    files: [],
    error: null,

    chooseFolder: async () => {
      const picker = pickerWindow();
      if (!picker?.showDirectoryPicker) {
        set({ error: 'Этот браузер не умеет отслеживать папки.' });
        return;
      }

      let handle: DirectoryHandle;
      try {
        handle = await picker.showDirectoryPicker({ mode: 'read' });
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        set({ error: 'Не удалось открыть папку. Проверьте права доступа.' });
        return;
      }

      stopTimer();
      directory = handle;
      known.clear();
      pendingSizes.clear();
      handles.clear();
      set({ folderName: handle.name, files: [], error: null });

      try {
        await rememberExisting(handle);
      } catch {
        set({ error: 'Нет доступа к папке. Выберите её заново.' });
        return;
      }

      timer = window.setInterval(() => void scan(), POLL_INTERVAL_MS);
    },

    setAutoProcess: (value) => {
      set({ autoProcess: value });
      if (value) void processQueue();
    },

    stop: () => {
      stopTimer();
      directory = null;
      known.clear();
      pendingSizes.clear();
      handles.clear();
      set({ folderName: null, files: [], error: null });
    },
  };
});
