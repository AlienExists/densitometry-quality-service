import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from '@/components/Layout/AppLayout';
import { UploadPage } from '@/pages/UploadPage';
import { ViewerPage } from '@/pages/ViewerPage';
import { ResultsPage } from '@/pages/ResultsPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <UploadPage /> },
      { path: 'viewer', element: <ViewerPage /> },
      { path: 'results', element: <ResultsPage /> },
    ],
  },
]);
