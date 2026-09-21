import { Layout, Menu, Typography, Space } from 'antd';
import { UploadOutlined, TableOutlined, FileImageOutlined } from '@ant-design/icons';
import { useLocation, useNavigate, Outlet } from 'react-router-dom';
import { OfflineIndicator } from '@/components/Common/OfflineIndicator';

const { Header, Content, Footer } = Layout;
const { Title } = Typography;

const NAV_ITEMS = [
  { key: '/', label: 'Загрузка', icon: <UploadOutlined /> },
  { key: '/viewer', label: 'Просмотр и анализ', icon: <FileImageOutlined /> },
  { key: '/results', label: 'Результаты', icon: <TableOutlined /> },
];

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <Title level={4} style={{ color: '#fff', margin: 0, whiteSpace: 'nowrap' }}>
          QC Денситометрии
        </Title>
        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={[location.pathname]}
          items={NAV_ITEMS}
          onClick={(e) => navigate(e.key)}
          style={{ flex: 1, minWidth: 0 }}
        />
        <Space>
          <OfflineIndicator />
        </Space>
      </Header>
      <Content style={{ padding: '24px 32px' }}>
        <Outlet />
      </Content>
      <Footer style={{ textAlign: 'center', color: '#999' }}>
        Хакатон — Сервис ИИ по оценке качества исследований плотности костей · 2026
      </Footer>
    </Layout>
  );
}
