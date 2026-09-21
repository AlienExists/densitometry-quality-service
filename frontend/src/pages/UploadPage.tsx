import { Space, Typography, Tabs } from 'antd';
import { UploadZone } from '@/components/Upload/UploadZone';
import { BatchUpload } from '@/components/Upload/BatchUpload';

const { Title, Paragraph } = Typography;

export function UploadPage() {
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Title level={3}>Загрузка исследования</Title>
        <Paragraph type="secondary">
          Загрузите одно DICOM-исследование или пакет исследований в ZIP-архиве для
          автоматической оценки качества.
        </Paragraph>
      </div>

      <Tabs
        items={[
          { key: 'single', label: 'Одно исследование', children: <UploadZone /> },
          { key: 'batch', label: 'Пакетная загрузка', children: <BatchUpload /> },
        ]}
      />
    </Space>
  );
}
