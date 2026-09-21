import { Card, Descriptions, Tag, Space, Statistic, Divider } from 'antd';
import { CheckCircleFilled, CloseCircleFilled } from '@ant-design/icons';
import type { ImageResult } from '@/types/api';
import { REGION_LABELS } from '@/utils/violationLabels';
import { ViolationsList } from './ViolationsList';

interface Props {
  image: ImageResult;
}

/** Основная панель результата — раздел 2.6 ТЗ ("критично для демо") */
export function ResultsPanel({ image }: Props) {
  const isGood = image.quality_class === 0;

  return (
    <Card
      title={
        <Space>
          {isGood ? (
            <CheckCircleFilled style={{ color: '#52c41a', fontSize: 20 }} />
          ) : (
            <CloseCircleFilled style={{ color: '#ff4d4f', fontSize: 20 }} />
          )}
          <span>{isGood ? 'Качественное изображение' : 'Обнаружено нарушение'}</span>
        </Space>
      }
      style={{
        borderColor: isGood ? '#b7eb8f' : '#ffa39e',
        borderWidth: 2,
      }}
    >
      <Descriptions column={1} size="small" style={{ marginBottom: 16 }}>
        <Descriptions.Item label="Анатомическая область">
          {REGION_LABELS[image.anatomical_region] ?? image.anatomical_region}
        </Descriptions.Item>
        <Descriptions.Item label="ID изображения">
          <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{image.image_uid}</span>
        </Descriptions.Item>
        <Descriptions.Item label="Статус обработки">
          <Tag color={image.processing_status === 'Success' ? 'success' : 'error'}>
            {image.processing_status}
          </Tag>
        </Descriptions.Item>
      </Descriptions>

      <Statistic
        title="Время обработки"
        value={image.time_of_processing}
        precision={2}
        suffix="сек"
        style={{ marginBottom: 16 }}
      />

      {image.visualization?.axis_angle_deg !== undefined && (
        <>
          <Statistic
            title="Угол наклона оси"
            value={image.visualization.axis_angle_deg}
            precision={1}
            suffix="°"
            valueStyle={{
              color: image.visualization.axis_angle_deg > 5 ? '#ff4d4f' : '#52c41a',
            }}
          />
          <div style={{ marginBottom: 16, color: '#999', fontSize: 12 }}>
            Допустимо: до 5°
          </div>
        </>
      )}

      <Divider style={{ margin: '12px 0' }} />
      <div style={{ marginBottom: 8, fontWeight: 600 }}>Обнаруженные нарушения</div>
      <ViolationsList image={image} />
    </Card>
  );
}
