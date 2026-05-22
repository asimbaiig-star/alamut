import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
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
      {/* Vercel Analytics — auto-tracks pageviews on the deployed
          Vercel build via the `_vercel/insights/*` endpoint. No-op
          in local dev unless `?mode=development` is appended to the
          script src, which we don't, so nothing is sent during
          `npm run dev`. */}
      <Analytics />
    </ErrorBoundary>
  );
}
