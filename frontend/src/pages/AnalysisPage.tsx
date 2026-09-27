import { Link } from 'react-router-dom';
import { PageHeading, Segmented } from '@/components/ui';
import {
  formatSeconds,
  regionLabel,
  violationCodes,
  violationLabel,
} from '@/lib/labels';
import { useResultsStore } from '@/stores/results';
import type { StudyRecord } from '@/types/study';

function ScanViewer({ record }: { record: StudyRecord }) {
  const { preview, fileName, source } = record;

  if (preview?.url) {
    return (
      <div className="viewer">
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
