import { ThemeToggle } from '@/components/theme-toggle';
import { ErrorBoundary } from '@/components/error-boundary';
import { WizardProvider } from '@/features/wizard/wizard-provider';
import { WizardShell } from '@/features/wizard/components/wizard-shell';

function App() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 p-6 md:p-10">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">QuickBI</h1>
          <p className="text-muted-foreground">
            Análisis exploratorio y BI 100% en el navegador. Tus datos nunca salen de tu
            máquina.
          </p>
        </div>
        <ThemeToggle />
      </header>

      <ErrorBoundary>
        <WizardProvider>
          <WizardShell />
        </WizardProvider>
      </ErrorBoundary>
    </main>
  );
}

export default App;
