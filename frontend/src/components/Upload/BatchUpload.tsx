import { useState } from 'react';
import { Upload, Card, Progress, Space, Typography, Alert, message } from 'antd';
import { FileZipOutlined } from '@ant-design/icons';
import type { UploadProps, UploadRequestOption } from 'antd/es/upload/interface';
import { analyzeBatch } from '@/api/analyze';
import { getErrorMessage } from '@/api/client';

const { Dragger } = Upload;
const { Text } = Typography;

type Phase = 'idle' | 'uploading' | 'processing' | 'done' | 'error';

export function BatchUpload() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleUpload = async (options: UploadRequestOption) => {
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
      await analyzeBatch(file, (percent: number) => {
        setUploadProgress(percent);
        if (percent === 100) setPhase('processing');
      });

      setPhase('done');
      message.success('Готово — файл results.xlsx скачан');
      options.onSuccess?.({});
    } catch (err) {
      const msg = getErrorMessage(err);
      setErrorMessage(msg);
      setPhase('error');
      options.onError?.(err as Error);
    }
  };

  const draggerProps: UploadProps = {
    name: 'file',
    multiple: false,
    accept: '.zip',
    showUploadList: false,
    customRequest: handleUpload,
    disabled: phase === 'uploading' || phase === 'processing',
  };

  return (
    <Card title="Пакетная загрузка (ZIP-архив)" style={{ maxWidth: 720 }}>
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Dragger {...draggerProps}>
          <p className="ant-upload-drag-icon">
            <FileZipOutlined />
          </p>
          <p className="ant-upload-text">Перетащите ZIP-архив с исследованиями</p>
          <p className="ant-upload-hint">.dcm файлы внутри архива</p>
        </Dragger>

        {(phase === 'uploading' || phase === 'processing') && (
          <div>
            <Text>
              {phase === 'uploading' ? 'Загрузка архива…' : 'Обработка на сервере…'}
            </Text>
            <Progress
              percent={phase === 'processing' ? 100 : uploadProgress}
              status="active"
            />
          </div>
        )}

        {phase === 'done' && (
          <Alert type="success" showIcon message="Обработка завершена — файл results.xlsx скачан" />
        )}

        {errorMessage && (
          <Alert
            type="error"
            showIcon
            message={errorMessage}
            action={<a onClick={() => setPhase('idle')}>Попробовать снова</a>}
          />
        )}
      </Space>
    </Card>
  );
}
