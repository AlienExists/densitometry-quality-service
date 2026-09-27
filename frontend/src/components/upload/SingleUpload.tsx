import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getErrorMessage } from '@/api/client';
import { Dropzone, TaskCard } from '@/components/Dropzone';
import { CrossIcon, UploadIcon } from '@/components/Icons';
import { ProgressBar } from '@/components/ui';
import { hasExtension } from '@/lib/files';
import { analyzeDicomFile } from '@/services/analysis';

const MAX_SIZE_MB = 200;

type Task =
  | { stage: 'idle' }
  | { stage: 'uploading'; fileName: string; progress: number }
  | { stage: 'processing'; fileName: string }
  | { stage: 'error'; fileName: string; message: string };

export function SingleUpload() {
  const navigate = useNavigate();
  const [task, setTask] = useState<Task>({ stage: 'idle' });

  const handleFile = async (file: File) => {
    if (!hasExtension(file, '.dcm')) {
      setTask({ stage: 'error', fileName: file.name, message: 'Нужен файл в формате DICOM (.dcm).' });
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setTask({
        stage: 'error',
        fileName: file.name,
        message: `Файл больше ${MAX_SIZE_MB} МБ. Загрузите снимок меньшего размера.`,
      });
      return;
    }

    setTask({ stage: 'uploading', fileName: file.name, progress: 0 });

    try {
      await analyzeDicomFile(file, 'single', (progress) => {
        setTask(
          progress >= 100
            ? { stage: 'processing', fileName: file.name }
            : { stage: 'uploading', fileName: file.name, progress },
        );
      });
      navigate('/analysis');
    } catch (error) {
      setTask({ stage: 'error', fileName: file.name, message: getErrorMessage(error) });
    }
  };

  if (task.stage === 'idle') {
    return (
      <Dropzone
        accept=".dcm,application/dicom"
        icon={<UploadIcon />}
        title="Перетащите DICOM-файл сюда"
        hint="Или нажмите, чтобы выбрать файл"
        buttonLabel="Выбрать файл"
        onFile={handleFile}
      />
    );
  }

  if (task.stage === 'error') {
    return (
      <TaskCard icon={<CrossIcon />} title={task.fileName} tone="error">
        <p className="dropzone__error" role="alert">
          {task.message}
        </p>
        <button type="button" className="button" onClick={() => setTask({ stage: 'idle' })}>
          Выбрать другой файл
        </button>
      </TaskCard>
    );
  }

  return (
    <TaskCard icon={<UploadIcon />} title={task.fileName}>
      <div className="task-progress" aria-live="polite">
        <ProgressBar
          label="Обработка файла"
          value={task.stage === 'uploading' ? task.progress : undefined}
        />
        <p className="dropzone__hint">
          {task.stage === 'uploading' ? `Загрузка ${task.progress}%` : 'Анализ снимка…'}
        </p>
      </div>
    </TaskCard>
  );
}
