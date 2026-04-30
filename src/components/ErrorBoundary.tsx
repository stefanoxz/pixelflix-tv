import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "./ui/button";
import { RefreshCw, AlertCircle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-background">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Ops! Algo deu errado</h1>
          <p className="text-muted-foreground mb-8 max-w-md">
            A aplicação encontrou um erro inesperado. Tente recarregar a página para continuar.
          </p>
          <Button 
            onClick={() => window.location.reload()}
            className="bg-gradient-primary"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Recarregar página
          </Button>
          {process.env.NODE_ENV === "development" && (
            <pre className="mt-8 p-4 bg-muted rounded text-left text-xs overflow-auto max-w-full">
              {this.state.error?.toString()}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
