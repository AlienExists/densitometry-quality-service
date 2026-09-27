import { useState } from 'react';
import { PageHeading, Segmented } from '@/components/ui';
import { BatchUpload } from '@/components/upload/BatchUpload';
import { FolderMonitor } from '@/components/upload/FolderMonitor';
import { SingleUpload } from '@/components/upload/SingleUpload';
import { useBackendStatus } from '@/hooks/useBackendStatus';

type Mode = 'single' | 'batch' | 'monitor';

const MODES: { value: Mode; label: string }[] = [
  { value: 'single', label: 'Одно исследование' },
  { value: 'batch', label: 'Пакетная загрузка' },
  { value: 'monitor', label: 'Мониторинг папки' },
];

export function UploadPage() {
  const [mode, setMode] = useState<Mode>('single');
  const backend = useBackendStatus();

  return (
    <main className="page">
      <PageHeading
        title="Загрузка исследований"
        subtitle="Одно исследование, пакет из ZIP-архива или автоматический мониторинг папки"
      />

      {backend === 'offline' && (
        <div className="banner" role="status">
          Сервер анализа не отвечает. Проверьте, что backend запущен: загрузка заработает, как
          только он станет доступен.
        </div>
      )}

      <section className="panel">
        <Segmented options={MODES} value={mode} onChange={setMode} label="Способ загрузки" />
        <div className="panel__body">
          {mode === 'single' && <SingleUpload />}
          {mode === 'batch' && <BatchUpload />}
          {mode === 'monitor' && <FolderMonitor />}
        </div>
      </section>
    </main>
  );
}
