import { useState } from 'react';
import { Upload, message, Progress, Card, Typography, Space, Alert } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import { useNavigate } from 'react-router-dom';
import { analyzeSingle } from '@/api/analyze';
import { getErrorMessage } from '@/api/client';
import { useResultsStore } from '@/stores/useResultsStore';
import { useUploadStore } from '@/stores/useUploadStore';
import { USE_MOCKS, mockAnalyzeResponse } from '@/utils/mockData';

const { Dragger } = Upload;
const { Text } = Typography;

const ALLOWED_EXTENSIONS = ['.dcm'];
const MAX_SIZE_MB = 200;

/** Загрузка одного DICOM-файла — раздел 2.4 ТЗ, п. "Одиночная загрузка" */
export function UploadZone() {
  const navigate = useNavigate();
  const addResult = useResultsStore((s) => s.addResult);
  const { stage, progress, errorMessage, setStage, setProgress, setError, reset } =
    useUploadStore();
  const [fileName, setFileName] = useState<string | null>(null);

  const validateFile = (file: File): string | null => {
    const nameLower = file.name.toLowerCase();
    const hasValidExt = ALLOWED_EXTENSIONS.some((ext) => nameLower.endsWith(ext));
    if (!hasValidExt) {
      return 'Не DICOM-файл. Ожидается файл с расширением .dcm';
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return `Файл слишком большой (максимум ${MAX_SIZE_MB} МБ).`;
    }
    return null;
  };

  const handleUpload: UploadProps['customRequest'] = async (options) => {
    const file = options.file as File;
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      message.error(validationError);
      options.onError?.(new Error(validationError));
      return;
    }

    setFileName(file.name);
    reset();
    setStage('uploading');

    try {
      let result;
      if (USE_MOCKS) {
        // имитация задержки сети для реалистичного демо на mock-данных
        await new Promise((resolve) => setTimeout(resolve, 900));
        setProgress(100);
        setStage('processing');
        await new Promise((resolve) => setTimeout(resolve, 700));
        result = mockAnalyzeResponse;
      } else {
        result = await analyzeSingle(file, (percent) => {
          setProgress(percent);
          if (percent === 100) setStage('processing');
        });
      }

      addResult(result);
      setStage('done');
      message.success('Исследование обработано');
      navigate('/viewer');
    } catch (err) {
      const msg = getErrorMessage(err);
      setError(msg);
      message.error(msg);
      options.onError?.(err as Error);
    }
  };

  return (
    <Card title="Загрузка исследования" style={{ maxWidth: 720 }}>
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Dragger
          name="file"
          multiple={false}
          accept=".dcm"
          showUploadList={false}
          customRequest={handleUpload}
          disabled={stage === 'uploading' || stage === 'processing'}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">Перетащите DICOM-файл (.dcm) сюда</p>
          <p className="ant-upload-hint">или нажмите, чтобы выбрать файл. Максимум {MAX_SIZE_MB} МБ.</p>
        </Dragger>

        {fileName && (stage === 'uploading' || stage === 'processing' || stage === 'done') && (
          <div>
            <Text>{fileName}</Text>
            <Progress
              percent={stage === 'processing' || stage === 'done' ? 100 : progress}
              status={stage === 'processing' ? 'active' : stage === 'done' ? 'success' : 'active'}
              format={() =>
                stage === 'processing'
                  ? 'Анализ на сервере…'
                  : stage === 'done'
                    ? 'Готово'
                    : `${progress}%`
              }
            />
          </div>
        )}

        {errorMessage && (
          <Alert
            type="error"
            showIcon
            message={errorMessage}
            action={
              <a onClick={() => reset()} role="button">
                Попробовать снова
              </a>
            }
          />
        )}
      </Space>
    </Card>
  );
}
