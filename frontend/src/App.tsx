import { ConfigProvider } from 'antd';
import ruRU from 'antd/locale/ru_RU';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { ErrorBoundary } from '@/components/Common/ErrorBoundary';

export default function App() {
  return (
    <ConfigProvider
      locale={ruRU}
      theme={{
        token: {
          colorPrimary: '#2f54eb',
          borderRadius: 6,
        },
      }}
    >
      <ErrorBoundary>
        <RouterProvider router={router} />
      </ErrorBoundary>
    </ConfigProvider>
  );
}
