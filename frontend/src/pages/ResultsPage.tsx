import { Space, Typography } from 'antd';
import { ResultsTable } from '@/components/Table/ResultsTable';

const { Title } = Typography;

export function ResultsPage() {
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Title level={3}>Результаты обработки</Title>
      <ResultsTable />
    </Space>
  );
}
