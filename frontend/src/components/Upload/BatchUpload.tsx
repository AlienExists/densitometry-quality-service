import { useRef, useState } from 'react';
import { Upload, Card, Progress, Button, Space, Typography, Alert, message } from 'antd';
import { FileZipOutlined, StopOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import { analyzeBatch, pollBatchStatus } from '@/api/analyze';
import { getErrorMessage } from '@/api/client';
import type { BatchStatusResponse } from '@/types/api';
import { useResultsStore } from '@/stores/useResultsStore';

const { Dragger } = Upload;
const { Text } = Typography;

/** Пакетная загрузка ZIP-архива — раздел 2.4 ТЗ */
export function BatchUpload() {
  const [status, setStatus] = useState<BatchStatusResponse | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'polling' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const cancelPollRef = useRef<(() => void) | null>(null);
  const addResult = useResultsStore((s) => s.addResult);

  const handleCancel = () => {
    cancelPollRef.current?.();
    setPhase('idle');
    setStatus(null);
    message.info('Обработка отменена');
  };

  const handleUpload: UploadProps['customRequest'] = async (options) => {
    const file = options.file as File;
    if (!file.name.toLowerCase().endsWith('.zip')) {
      const msg = 'Ожидается ZIP-архив с DICOM-файлами.';
      setErrorMessage(msg);
      message.error(msg);
      options.onError?.(new Error(msg));
      return;
    }

    setPhase('uploading');
    setErrorMessage(null);
    setUploadProgress(0);

    try {
      const { job_id } = await analyzeBatch(file, setUploadProgress);
      setPhase('polling');

      cancelPollRef.current = pollBatchStatus(
        job_id,
        (newStatus) => {
          setStatus(newStatus);
          if (newStatus.status === 'completed') {
            newStatus.results?.forEach((r) => addResult(r));
            message.success('Пакетная обработка завершена');
            setPhase('idle');
          }
          if (newStatus.status === 'failed') {
            setErrorMessage(newStatus.error ?? 'Ошибка пакетной обработки.');
            setPhase('error');
          }
        },
        (err) => {
          setErrorMessage(getErrorMessage(err));
          setPhase('error');
        },
      );
      options.onSuccess?.({});
    } catch (err) {
      const msg = getErrorMessage(err);
      setErrorMessage(msg);
      setPhase('error');
      options.onError?.(err as Error);
    }
  };

  const percent =
    phase === 'uploading'
      ? uploadProgress
      : status && status.total > 0
        ? Math.round((status.processed / status.total) * 100)
        : 0;

  return (
    <Card title="Пакетная загрузка (ZIP-архив)" style={{ maxWidth: 720 }}>
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Dragger
          name="file"
          multiple={false}
          accept=".zip"
          showUploadList={false}
          customRequest={handleUpload}
          disabled={phase === 'uploading' || phase === 'polling'}
        >
          <p className="ant-upload-drag-icon">
            <FileZipOutlined />
          </p>
          <p className="ant-upload-text">Перетащите ZIP-архив с исследованиями</p>
          <p className="ant-upload-hint">Файлы .dcm внутри архива, без вложенной структуры важности</p>
        </Dragger>

        {(phase === 'uploading' || phase === 'polling') && (
          <div>
            <Text>
              {phase === 'uploading'
                ? 'Загрузка архива…'
                : `Обработано ${status?.processed ?? 0} из ${status?.total ?? '…'}`}
            </Text>
            <Progress percent={percent} status="active" />
            <Button icon={<StopOutlined />} onClick={handleCancel} danger>
              Отменить
            </Button>
          </div>
        )}

        {errorMessage && <Alert type="error" showIcon message={errorMessage} />}
      </Space>
    </Card>
  );
}
