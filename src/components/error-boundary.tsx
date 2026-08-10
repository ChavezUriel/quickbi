import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Sin esto, cualquier excepción durante el render deja la pantalla en blanco y
 * el usuario pierde el dataset que tenía cargado, sin forma de volver atrás.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // La consola es el único destino admisible: la app promete no enviar nada
    // a ningún servidor, así que aquí no hay (ni puede haber) telemetría.
    console.error('QuickBI ha fallado durante el render:', error, info.componentStack);
  }

  override render() {
    const { error } = this.state;

    if (!error) return this.props.children;

    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col justify-center gap-4 p-4 sm:p-6">
        <Alert variant="destructive" role="alert">
          <AlertTitle>Algo ha ido mal</AlertTitle>
          <AlertDescription>
            <p>
              Se ha producido un error inesperado. Tus datos siguen solo en esta pestaña y
              no se han enviado a ningún sitio.
            </p>
            <p className="font-mono text-xs break-all">{error.message}</p>
          </AlertDescription>
        </Alert>

        <div className="flex gap-2">
          <Button onClick={() => this.setState({ error: null })}>Reintentar</Button>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Recargar la página
          </Button>
        </div>
      </main>
    );
  }
}
