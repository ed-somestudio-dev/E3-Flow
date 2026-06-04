import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-destructive/10 border border-destructive/20 rounded-lg max-w-2xl mx-auto my-12 text-destructive space-y-4">
          <h1 className="text-xl font-bold">Ocorreu um erro ao carregar esta tela:</h1>
          <p className="text-sm font-semibold">{this.state.error?.message}</p>
          <pre className="text-xs bg-background p-4 rounded overflow-auto max-h-60 text-foreground">
            {this.state.error?.stack}
          </pre>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm hover:bg-primary/90 font-semibold"
          >
            Recarregar Página
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
