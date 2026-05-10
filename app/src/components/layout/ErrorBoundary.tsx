// App-root error boundary. Catches render errors in any descendant and shows a
// recovery panel instead of a blank white page.
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface to console for debugging; in a real app you'd ship this to Sentry/etc.
    console.error('[Alamut] uncaught error in render tree:', error, info);
  }

  reset = () => {
    this.setState({ error: null });
  };

  hardReset = () => {
    if (confirm('This clears your local session data and reloads. Continue?')) {
      try { localStorage.removeItem('alamut.v1'); } catch { /* ignore */ }
      try { localStorage.removeItem('alamut.theme'); } catch { /* ignore */ }
      location.reload();
    }
  };

  render(): ReactNode {
    if (this.state.error) {
      const stack = this.state.error.stack || this.state.error.message;
      return (
        <div style={{
          minHeight: '100vh',
          background: 'var(--paper)',
          color: 'var(--ink)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32,
        }}>
          <div style={{ maxWidth: 560, width: '100%' }}>
            <Logo size={20} tag="ALAMUT · ERROR" />
            <h1 style={{ fontFamily: 'var(--serif)', fontSize: 36, letterSpacing: '-0.02em', margin: '32px 0 14px', fontWeight: 400 }}>
              Something <em style={{ color: 'var(--accent)' }}>broke</em>.
            </h1>
            <p style={{ color: 'var(--ink-80)', fontSize: 15, lineHeight: 1.55, marginBottom: 24 }}>
              The app caught an error before it could crash. Try going back to a working page;
              if it keeps happening, hard-reset to clear local state.
            </p>

            <details style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', borderRadius: 6, padding: 14, marginBottom: 24 }}>
              <summary style={{ cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 11, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--ink-60)' }}>
                Error details
              </summary>
              <pre style={{ marginTop: 12, fontSize: 11, color: 'var(--ink-80)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 300, overflow: 'auto' }}>
                {stack}
              </pre>
            </details>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Button onClick={this.reset}>Try again</Button>
              <Button variant="ghost" onClick={() => { location.href = '/'; }}>Go home</Button>
              <Button variant="danger" onClick={this.hardReset}>Hard reset</Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
