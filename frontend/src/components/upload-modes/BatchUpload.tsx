import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getErrorMessage } from '@/api/client';
import { Dropzone, TaskCard } from '@/components/Dropzone';
import { ArchiveIcon, CheckIcon, CrossIcon } from '@/components/Icons';
import { ProgressBar } from '@/components/ui';
import { downloadBlob, hasExtension } from '@/lib/files';
import { pluralRu } from '@/lib/labels';
import { predictBatchArchive } from '@/api/predict';
import { analyzeArchive, type BatchSummary } from '@/services/analysis';

type Task =
  | { stage: 'idle' }
  | { stage: 'uploading'; fileName: string; progress: number }
  | { stage: 'processing'; fileName: string }
  | { stage: 'done'; fileName: string; file: File; summary: BatchSummary }
  | { stage: 'error'; fileName: string; message: string };

type ArchiveState = { status: 'idle' } | { status: 'loading' } | { status: 'error'; message: string };

export function BatchUpload() {
  const [task, setTask] = useState<Task>({ stage: 'idle' });
  const [archive, setArchive] = useState<ArchiveState>({ status: 'idle' });

  const downloadWithVisuals = async (file: File) => {
    setArchive({ status: 'loading' });
    try {
      downloadBlob(await predictBatchArchive(file), 'results.zip');
      setArchive({ status: 'idle' });
    } catch (error) {
      setArchive({ status: 'error', message: getErrorMessage(error) });
    }
  };

  const handleFile = async (file: File) => {
    if (!hasExtension(file, '.zip')) {
      setTask({ stage: 'error', fileName: file.name, message: 'Нужен ZIP-архив с файлами .dcm.' });
      return;
    }

    setTask({ stage: 'uploading', fileName: file.name, progress: 0 });

    try {
      const summary = await analyzeArchive(file, (progress) => {
        setTask(
          progress >= 100
            ? { stage: 'processing', fileName: file.name }
            : { stage: 'uploading', fileName: file.name, progress },
        );
      });
      setArchive({ status: 'idle' });
      setTask({ stage: 'done', fileName: file.name, file, summary });
    } catch (error) {
      setTask({ stage: 'error', fileName: file.name, message: getErrorMessage(error) });
    }
  };

  const reset = () => setTask({ stage: 'idle' });

  switch (task.stage) {
    case 'idle':
      return (
        <Dropzone
          accept=".zip,application/zip"
          icon={<ArchiveIcon />}
          title="Перетащите ZIP-архив сюда"
          hint="Внутри архива — файлы .dcm, можно во вложенных папках"
          buttonLabel="Выбрать архив"
          onFile={handleFile}
        />
      );

    case 'error':
      return (
        <TaskCard icon={<CrossIcon />} title={task.fileName} tone="error">
          <p className="dropzone__error" role="alert">
            {task.message}
          </p>
          <button type="button" className="button" onClick={reset}>
            Выбрать другой архив
          </button>
        </TaskCard>
      );

    case 'done': {
      const { total, passed, failed, report } = task.summary;
      return (
        <TaskCard icon={<CheckIcon />} title={task.fileName}>
          <p className="batch-summary" aria-live="polite">
            Обработано {total} {pluralRu(total, ['файл', 'файла', 'файлов'])}:{' '}
            <span className="text-ok">{passed} в норме</span>,{' '}
            <span className="text-danger">
              {failed} {pluralRu(failed, ['требует', 'требуют', 'требуют'])} внимания
            </span>
          </p>
          <div className="button-row">
            <Link to="/results" className="button">
              Открыть результаты
            </Link>
            <button
              type="button"
              className="button button--ghost"
              onClick={() => downloadBlob(report, 'results.xlsx')}
            >
              Скачать отчёт
            </button>
          </div>
          <button
            type="button"
            className="text-button"
            disabled={archive.status === 'loading'}
            onClick={() => void downloadWithVisuals(task.file)}
          >
            {archive.status === 'loading'
              ? 'Готовим архив с визуализациями…'
              : 'Скачать отчёт с визуализациями нарушений (.zip)'}
          </button>
          {archive.status === 'error' && (
            <p className="dropzone__error" role="alert">
              {archive.message}
            </p>
          )}
          <button type="button" className="text-button" onClick={reset}>
            Загрузить другой архив
          </button>
        </TaskCard>
      );
    }

    default:
      return (
        <TaskCard icon={<ArchiveIcon />} title={task.fileName}>
          <div className="task-progress" aria-live="polite">
            <ProgressBar
              label="Обработка архива"
              value={task.stage === 'uploading' ? task.progress : undefined}
            />
            <p className="dropzone__hint">
              {task.stage === 'uploading'
                ? `Загрузка ${task.progress}%`
                : 'Анализ снимков из архива. Для больших архивов это может занять несколько минут.'}
            </p>
          </div>
        </TaskCard>
      );
  }
}
