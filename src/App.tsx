import { ErrorBoundary } from '@/components/error-boundary';
import { WizardProvider } from '@/features/wizard/wizard-provider';
import { WizardShell } from '@/features/wizard/components/wizard-shell';

function App() {
  return (
    <ErrorBoundary>
      <WizardProvider>
        <WizardShell />
      </WizardProvider>
    </ErrorBoundary>
  );
}

export default App;
