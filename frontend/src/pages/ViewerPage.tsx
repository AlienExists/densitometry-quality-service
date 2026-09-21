import { Row, Col, Empty, Tabs, Typography, Space } from 'antd';
import { Link } from 'react-router-dom';
import { useResultsStore } from '@/stores/useResultsStore';
import { ImageViewer } from '@/components/Viewer/ImageViewer';
import { ResultsPanel } from '@/components/Results/ResultsPanel';

const { Title } = Typography;

export function ViewerPage() {
  const activeStudy = useResultsStore((s) => s.activeStudy);
  const activeImageIndex = useResultsStore((s) => s.activeImageIndex);
  const setActiveImageIndex = useResultsStore((s) => s.setActiveImageIndex);

  if (!activeStudy) {
    return (
      <Empty description="Нет активного исследования">
        <Link to="/">Загрузить исследование</Link>
      </Empty>
    );
  }

  const activeImage = activeStudy.images[activeImageIndex];

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Title level={3} style={{ marginBottom: 0 }}>
          Исследование
        </Title>
        <span style={{ color: '#999', fontFamily: 'monospace', fontSize: 12 }}>
          {activeStudy.study_uid}
        </span>
      </div>

      {activeStudy.images.length > 1 && (
        <Tabs
          activeKey={String(activeImageIndex)}
          onChange={(key) => setActiveImageIndex(Number(key))}
          items={activeStudy.images.map((img, i) => ({
            key: String(i),
            label: `Снимок ${i + 1} (${img.anatomical_region})`,
          }))}
        />
      )}

      <Row gutter={24}>
        <Col flex="auto">
          <ImageViewer image={activeImage} />
        </Col>
        <Col flex="360px">
          <ResultsPanel image={activeImage} />
        </Col>
      </Row>
    </Space>
  );
}
