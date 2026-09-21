import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Result, Button } from 'antd';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/** Ловит падения любого дочернего компонента, чтобы не было "белого экрана"
 *  на демо (раздел 2.7 ТЗ фронтендера — это явно отмечено как критично). */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <Result
          status="error"
          title="Что-то пошло не так"
          subTitle={this.state.error?.message ?? 'Непредвиденная ошибка интерфейса.'}
          extra={
            <Button type="primary" onClick={this.handleReset}>
              Попробовать снова
            </Button>
          }
        />
      );
    }
    return this.props.children;
  }
}
