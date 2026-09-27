import { Component, type ErrorInfo, type ReactNode } from 'react';

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

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="page page--center">
        <div className="panel panel--narrow empty-state">
          <h1 className="empty-state__title">Интерфейс перестал отвечать</h1>
          <p className="empty-state__text">{this.state.error.message}</p>
          <button type="button" className="button" onClick={() => window.location.reload()}>
            Перезагрузить страницу
          </button>
        </div>
      </main>
    );
  }
}
