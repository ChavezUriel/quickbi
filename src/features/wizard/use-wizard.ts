import { useContext } from 'react';
import { WizardContext, type WizardStore } from './wizard-context';

export function useWizard(): WizardStore {
  const store = useContext(WizardContext);
  if (!store) throw new Error('useWizard debe usarse dentro de un <WizardProvider>.');
  return store;
}
