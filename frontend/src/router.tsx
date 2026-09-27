import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { LandingPage } from '@/pages/LandingPage';
import { UploadPage } from '@/pages/UploadPage';
import { AnalysisPage } from '@/pages/AnalysisPage';
import { ResultsPage } from '@/pages/ResultsPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <LandingPage /> },
      { path: 'upload', element: <UploadPage /> },
      { path: 'analysis', element: <AnalysisPage /> },
      { path: 'results', element: <ResultsPage /> },
      { path: 'viewer', element: <Navigate to="/analysis" replace /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
