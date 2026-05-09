import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Dashboard render failure', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="setup-screen">
          <section className="panel empty-state" role="alert">
            <p className="eyebrow">Something broke</p>
            <h1>Dashboard could not render.</h1>
            <p className="muted">Refresh the page. If it continues, check the browser console and Supabase migration status.</p>
            <button className="primary-action" type="button" onClick={() => this.setState({ error: null })}>
              Try again
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
