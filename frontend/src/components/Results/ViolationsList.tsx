import { List, Tag, Empty } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import type { ImageResult } from '@/types/api';
import { violationLabel } from '@/utils/violationLabels';
import { ConfidenceBar } from './ConfidenceBar';

interface Props {
  image: ImageResult;
}

/** Список нарушений с иконками и confidence — раздел 2.6 ТЗ */
export function ViolationsList({ image }: Props) {
  if (image.violation_type.length === 0) {
    return <Empty description="Нарушений не обнаружено" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
  }

  return (
    <List
      size="small"
      dataSource={image.violation_type}
      renderItem={(type, i) => (
        <List.Item>
          <div style={{ width: '100%' }}>
            <Tag icon={<WarningOutlined />} color="error" style={{ marginBottom: 4 }}>
              {violationLabel(type)}
            </Tag>
            <ConfidenceBar value={image.confidence[i] ?? 0} />
          </div>
        </List.Item>
      )}
    />
  );
}
