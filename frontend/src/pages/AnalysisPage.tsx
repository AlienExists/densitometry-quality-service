import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeading, Segmented } from '@/components/ui';
import {
  formatSeconds,
  regionLabel,
  violationCodes,
  violationLabel,
} from '@/lib/labels';
import { loadVisual, needsVisual } from '@/services/analysis';
import { useResultsStore } from '@/stores/results';
import type { StudyRecord, VisualState } from '@/types/study';

type ViewMode = 'scan' | 'visual';

const VIEW_OPTIONS: { value: ViewMode; label: string }[] = [
  { value: 'scan', label: 'Снимок' },
  { value: 'visual', label: 'Нарушения' },
];

function ViewerControls({
  visual,
  mode,
  onChange,
}: {
  visual: VisualState | undefined;
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}) {
  if (visual?.status === 'loading') {
    return <p className="viewer__badge">Готовим визуализацию…</p>;
  }
  if (visual?.status !== 'ready') return null;
  return (
    <Segmented
      className="segmented--compact viewer__switch"
      label="Режим просмотра"
      value={mode}
      onChange={onChange}
      options={VIEW_OPTIONS}
    />
  );
}

function ScanViewer({ record }: { record: StudyRecord }) {
  const { preview, fileName, source } = record;
  const visual = useResultsStore((s) => s.visuals[record.id]);
  const [mode, setMode] = useState<ViewMode>('scan');

  useEffect(() => {
    setMode('scan');
    if (needsVisual(record)) void loadVisual(record);
  }, [record]);

  const controls = <ViewerControls visual={visual} mode={mode} onChange={setMode} />;

  if (mode === 'visual' && visual?.status === 'ready') {
    return (
      <div className="viewer">
        {controls}
        <img
          className="viewer__image"
          src={visual.url}
          alt={`Визуализация нарушений на снимке ${fileName}`}
        />
      </div>
    );
  }

  if (preview?.url) {
    return (
      <div className="viewer">
        {controls}
        <img className="viewer__image" src={preview.url} alt={`Снимок ${fileName}`} />
      </div>
    );
  }

  const message =
    source === 'batch'
      ? 'Снимки из ZIP-архива не отображаются. Загрузите файл отдельно, чтобы увидеть изображение.'
      : (preview?.error ?? 'Изображение недоступно для предпросмотра.');

  return (
    <div className="viewer viewer--empty">
      {controls}
      <span className="viewer__scanline" aria-hidden="true" />
      <p className="viewer__message">{message}</p>
    </div>
  );
}

function Verdict({ record }: { record: StudyRecord }) {
  const { result } = record;
  const failedProcessing = result.processing_status.toLowerCase() !== 'success';
  const violations = violationCodes(result.violation_type);
  const region = regionLabel(result.anatomical_region);

  let title = 'Качество в норме';
  let text = 'Снимок пригоден для клинической интерпретации';
  let tone = 'ok';

  if (failedProcessing) {
    title = 'Снимок не обработан';
    text = 'Модель не смогла оценить файл. Проверьте снимок и загрузите его снова.';
    tone = 'danger';
  } else if (result.quality_class === 1) {
    title = 'Обнаружено нарушение!';
    text = 'Требуется коррекция перед клинической интерпретацией';
    tone = 'danger';
  }

  return (
    <div className="verdict">
      <div className="verdict__head">
        <h2 className={`verdict__title verdict__title--${tone}`}>{title}</h2>
        <p className="verdict__text">{text}</p>
      </div>

      {!failedProcessing && (
        <div className="verdict__section">
          <p className="label">Нарушения</p>
          {violations.length > 0 ? (
            <ul className="violations">
              {violations.map((code) => (
                <li key={code} className="violations__item">
                  {violationLabel(code)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted-text">
              {result.quality_class === 1
                ? 'Модель отметила снимок как некачественный, но не указала тип нарушения.'
                : 'Нарушений не обнаружено'}
            </p>
          )}
        </div>
      )}

      <dl className="facts">
        <div className="facts__item">
          <dt>Область</dt>
          <dd>{region.full}</dd>
        </div>
        <div className="facts__item">
          <dt>Время обработки</dt>
          <dd>{formatSeconds(result.time_of_processing)}</dd>
        </div>
        {!failedProcessing && result.quality_prob !== null && (
          <div className="facts__item">
            <dt>Вероятность нарушения</dt>
            <dd className={result.quality_class === 1 ? 'text-danger' : 'text-ok'}>
              {Math.round(result.quality_prob * 100)}%
            </dd>
          </div>
        )}
        <div className="facts__item facts__item--wide">
          <dt>Файл</dt>
          <dd className="facts__mono">{record.fileName}</dd>
        </div>
      </dl>
    </div>
  );
}

function EmptyAnalysis() {
  return (
    <main className="page">
      <PageHeading title="Исследование" />
      <section className="panel panel--narrow empty-state">
        <h2 className="empty-state__title">Здесь появится результат анализа</h2>
        <p className="empty-state__text">
          Загрузите DICOM-файл, чтобы увидеть снимок и найденные нарушения.
        </p>
        <Link to="/upload" className="button">
          Загрузить файл
        </Link>
      </section>
    </main>
  );
}

export function AnalysisPage() {
  const records = useResultsStore((s) => s.records);
  const activeRecordId = useResultsStore((s) => s.activeRecordId);
  const openRecord = useResultsStore((s) => s.openRecord);

  const active = records.find((r) => r.id === activeRecordId) ?? records[0];
  if (!active) return <EmptyAnalysis />;

  const studyImages = records
    .filter((r) => r.studyKey === active.studyKey)
    .sort((a, b) => a.receivedAt - b.receivedAt);

  const studyUid = active.preview?.studyUid || active.result.study_uid;
  const showUid = studyUid && !/^stub/i.test(studyUid);

  return (
    <main className="page">
      <PageHeading title="Исследование" subtitle={showUid ? studyUid : active.fileName} />

      {studyImages.length > 1 && (
        <Segmented
          className="segmented--compact"
          label="Снимки исследования"
          value={active.id}
          onChange={openRecord}
          options={studyImages.map((r, i) => ({
            value: r.id,
            label: `Снимок ${i + 1}: ${regionLabel(r.result.anatomical_region).short.toLowerCase()}`,
          }))}
        />
      )}

      <section className="analysis">
        <ScanViewer record={active} />
        <Verdict record={active} />
      </section>

      <div className="page-actions">
        <Link to="/results" className="text-button">
          Все результаты
        </Link>
        <Link to="/upload" className="text-button">
          Загрузить ещё
        </Link>
      </div>
    </main>
  );
}
