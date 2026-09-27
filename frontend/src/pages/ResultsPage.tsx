import { Link, useNavigate } from 'react-router-dom';
import { PageHeading } from '@/components/ui';
import { downloadReport } from '@/lib/files';
import { pluralRu, regionLabel, violationSummary } from '@/lib/labels';
import { useResultsStore } from '@/stores/results';
import type { StudyRecord } from '@/types/study';

function Quality({ record }: { record: StudyRecord }) {
  const { result } = record;
  if (result.processing_status.toLowerCase() !== 'success') {
    return <span className="text-danger">Не обработан</span>;
  }
  return result.quality_class === 1 ? (
    <span className="text-danger">Нарушение</span>
  ) : (
    <span className="text-ok">Качественное</span>
  );
}

function isFlagged(record: StudyRecord): boolean {
  return (
    record.result.quality_class === 1 ||
    record.result.processing_status.toLowerCase() !== 'success'
  );
}

export function ResultsPage() {
  const records = useResultsStore((s) => s.records);
  const openRecord = useResultsStore((s) => s.openRecord);
  const navigate = useNavigate();

  const open = (id: string) => {
    openRecord(id);
    navigate('/analysis');
  };

  if (records.length === 0) {
    return (
      <main className="page">
        <PageHeading title="Результаты обработки" />
        <section className="panel panel--narrow empty-state">
          <h2 className="empty-state__title">Пока нет обработанных исследований</h2>
          <p className="empty-state__text">
            Загрузите DICOM-файл или ZIP-архив — результаты появятся в этой таблице.
          </p>
          <Link to="/upload" className="button">
            Загрузить исследования
          </Link>
        </section>
      </main>
    );
  }

  const count = records.length;

  return (
    <main className="page">
      <PageHeading
        title="Результаты обработки"
        subtitle={`Все исследования за сессию: ${count} ${pluralRu(count, ['запись', 'записи', 'записей'])}`}
      />

      <section className="panel panel--table">
        <div className="table-scroll">
          <table className="results-table">
            <thead>
              <tr>
                <th scope="col">Название/UID</th>
                <th scope="col">Область</th>
                <th scope="col">Качество</th>
                <th scope="col">Нарушения</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr
                  key={record.id}
                  className={isFlagged(record) ? 'results-table__row--flagged' : undefined}
                  onClick={() => open(record.id)}
                >
                  <td>
                    <button
                      type="button"
                      className="results-table__name"
                      onClick={(event) => {
                        event.stopPropagation();
                        open(record.id);
                      }}
                    >
                      {record.fileName}
                    </button>
                  </td>
                  <td>{regionLabel(record.result.anatomical_region).short}</td>
                  <td>
                    <Quality record={record} />
                  </td>
                  <td>{violationSummary(record.result.violation_type) || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="panel__footer">
          <button type="button" className="button button--wide" onClick={() => downloadReport(records)}>
            Скачать .xlsx
          </button>
        </div>
      </section>
    </main>
  );
}
