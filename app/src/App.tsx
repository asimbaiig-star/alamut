import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { router } from './router';
import { ToastHost } from './components/ui/ToastHost';
import { ConfirmHost } from './components/ui/ConfirmHost';
import { ErrorBoundary } from './components/layout/ErrorBoundary';

export default function App() {
  useEffect(() => {
    document.body.setAttribute('data-accent', 'terracotta');
    const savedDensity = localStorage.getItem('alamut.density');
    document.body.setAttribute('data-density', savedDensity === 'compact' ? 'compact' : 'standard');
    const savedTheme = localStorage.getItem('alamut.theme');
    if (savedTheme === 'dark') document.body.setAttribute('data-theme', 'dark');
  }, []);
  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
      <ToastHost />
      <ConfirmHost />
      <SpeedInsights />
    </ErrorBoundary>
  );
}
