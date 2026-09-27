import { useNavigate } from 'react-router-dom';
import { CheckIcon, ClockIcon, CrossIcon, SpinnerIcon } from '@/components/Icons';
import { Toggle } from '@/components/ui';
import { useMonitorStore, type MonitorFile } from '@/stores/monitor';
import { useResultsStore } from '@/stores/results';

const STATUS_TEXT: Record<MonitorFile['status'], string> = {
  waiting: 'Ожидает',
  processing: 'В обработке…',
  done: 'Обработан',
  error: 'Ошибка',
};

function StatusIcon({ status }: { status: MonitorFile['status'] }) {
  switch (status) {
    case 'done':
      return <CheckIcon className="file-row__icon file-row__icon--ok" />;
    case 'processing':
      return <SpinnerIcon className="file-row__icon file-row__icon--spin" />;
    case 'error':
      return <CrossIcon className="file-row__icon file-row__icon--error" />;
    default:
      return <ClockIcon className="file-row__icon file-row__icon--muted" />;
  }
}

function FileRow({ file }: { file: MonitorFile }) {
  const navigate = useNavigate();
  const openRecord = useResultsStore((s) => s.openRecord);

  const content = (
    <>
      <StatusIcon status={file.status} />
      <span className="file-row__name">{file.name}</span>
      <span className={file.status === 'error' ? 'file-row__status text-danger' : 'file-row__status'}>
        {STATUS_TEXT[file.status]}
      </span>
    </>
  );

  if (file.status === 'done' && file.recordId) {
    const recordId = file.recordId;
    return (
      <li>
        <button
          type="button"
          className="file-row file-row--link"
          title="Открыть анализ"
          onClick={() => {
            openRecord(recordId);
            navigate('/analysis');
          }}
        >
          {content}
        </button>
      </li>
    );
  }

  return (
    <li className="file-row" title={file.message}>
      {content}
    </li>
  );
}

export function FolderMonitor() {
  const { supported, folderName, autoProcess, files, error, chooseFolder, setAutoProcess, stop } =
    useMonitorStore();

  if (!supported) {
    return (
      <div className="monitor">
        <div className="notice">
          <p className="notice__title">Браузер не поддерживает отслеживание папок</p>
          <p className="notice__text">
            Откройте BonAI в Google Chrome, Microsoft Edge или Яндекс Браузере. Страница должна быть
            открыта по адресу localhost или по https.
          </p>
        </div>
      </div>
    );
  }

  const waiting = files.filter((file) => file.status === 'waiting').length;

  return (
    <div className="monitor">
      <p className="label">Отслеживаемая папка</p>
      <div className="folder-picker">
        <div className={folderName ? 'field' : 'field field--empty'}>
          {folderName ?? 'Папка не выбрана'}
        </div>
        <button type="button" className="button" onClick={() => void chooseFolder()}>
          {folderName ? 'Изменить' : 'Выбрать папку'}
        </button>
      </div>
      {folderName && (
        <button type="button" className="text-button text-button--left" onClick={stop}>
          Остановить мониторинг
        </button>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="setting">
        <div>
          <p className="setting__title">Автоматическая обработка</p>
          <p className="setting__text">
            {autoProcess
              ? 'Новый файл в папке запускает анализ сразу после появления'
              : `Новые файлы ждут, пока вы включите обработку${waiting ? ` — в очереди: ${waiting}` : ''}`}
          </p>
        </div>
        <Toggle checked={autoProcess} onChange={setAutoProcess} label="Автоматическая обработка" />
      </div>

      <div className="divider" />

      <p className="label">Последние обнаруженные файлы</p>
      {files.length > 0 ? (
        <ul className="file-list" aria-live="polite">
          {files.map((file) => (
            <FileRow key={file.name} file={file} />
          ))}
        </ul>
      ) : (
        <p className="muted-text">
          {folderName
            ? 'Новые .dcm-файлы появятся здесь. Файлы, которые уже лежали в папке при подключении, не обрабатываются.'
            : 'Выберите папку, куда аппарат сохраняет снимки. Новые .dcm-файлы будут отправляться на анализ сами.'}
        </p>
      )}
    </div>
  );
}
