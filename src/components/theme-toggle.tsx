import { Monitor, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/lib/use-theme';
import type { ThemePreference } from '@/lib/theme';

const NEXT: Record<ThemePreference, ThemePreference> = {
  system: 'light',
  light: 'dark',
  dark: 'system',
};

const LABEL: Record<ThemePreference, string> = {
  system: 'Tema: el del sistema',
  light: 'Tema: claro',
  dark: 'Tema: oscuro',
};

const ICON = {
  system: Monitor,
  light: Sun,
  dark: Moon,
} as const;

export function ThemeToggle() {
  const { preference, setPreference } = useTheme();
  const Icon = ICON[preference];

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => setPreference(NEXT[preference])}
      aria-label={`${LABEL[preference]}. Cambiar a: ${LABEL[NEXT[preference]].toLowerCase()}`}
      title={LABEL[preference]}
    >
      <Icon />
    </Button>
  );
}
