import type { ReactNode } from 'react';
import { useRef } from 'react';
import { cn } from '@/lib/utils';
import { CHART_TYPE_LABEL } from '../labels';
import type { ChartType } from '../types';

export interface ChartTypePickerProps {
  value: ChartType;
  available: ChartType[];
  onChange: (type: ChartType) => void;
}

const CHART_ICONS: Record<ChartType, ReactNode> = {
  bar: (
    <svg
      className="size-10"
      viewBox="0 0 40 40"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="6" y="20" width="7" height="16" rx="1" />
      <rect x="16.5" y="10" width="7" height="26" rx="1" />
      <rect x="27" y="15" width="7" height="21" rx="1" />
      <line x1="4" y1="38" x2="36" y2="38" />
    </svg>
  ),
  line: (
    <svg
      className="size-10"
      viewBox="0 0 40 40"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="4,30 12,18 20,24 28,10 36,16" />
      <circle cx="4" cy="30" r="2" fill="currentColor" />
      <circle cx="12" cy="18" r="2" fill="currentColor" />
      <circle cx="20" cy="24" r="2" fill="currentColor" />
      <circle cx="28" cy="10" r="2" fill="currentColor" />
      <circle cx="36" cy="16" r="2" fill="currentColor" />
    </svg>
  ),
  pie: (
    <svg
      className="size-10"
      viewBox="0 0 40 40"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="20" cy="20" r="16" />
      <line x1="20" y1="20" x2="20" y2="4" />
      <line x1="20" y1="20" x2="33.9" y2="28" />
      <line x1="20" y1="20" x2="6.1" y2="28" />
    </svg>
  ),
};

export function ChartTypePicker({ value, available, onChange }: ChartTypePickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent, currentType: ChartType) => {
    const currentIndex = available.indexOf(currentType);
    if (currentIndex === -1) return;

    let targetIndex = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      targetIndex = (currentIndex + 1) % available.length;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      targetIndex = (currentIndex - 1 + available.length) % available.length;
    }

    if (targetIndex !== -1) {
      const nextType = available[targetIndex];
      if (nextType !== undefined) {
        onChange(nextType);
        setTimeout(() => {
          const targetEl = containerRef.current?.querySelector<HTMLDivElement>(
            `[data-chart-type="${nextType}"]`,
          );
          targetEl?.focus();
        }, 0);
      }
    }
  };

  return (
    <div
      ref={containerRef}
      role="radiogroup"
      aria-label="Tipo de gráfico"
      className="flex flex-wrap gap-3"
    >
      {available.map((type) => {
        const isSelected = value === type;
        return (
          <div
            key={type}
            role="radio"
            aria-checked={isSelected}
            tabIndex={isSelected ? 0 : -1}
            data-chart-type={type}
            onClick={() => onChange(type)}
            onKeyDown={(e) => handleKeyDown(e, type)}
            className={cn(
              'relative flex min-w-[100px] flex-1 max-w-[140px] cursor-pointer flex-col items-center justify-center rounded-xl border p-3 select-none outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              isSelected
                ? 'border-primary bg-primary/5 font-medium text-primary shadow-xs'
                : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground',
            )}
          >
            <div className="flex items-center justify-center p-1">
              {CHART_ICONS[type]}
            </div>
            <span className="mt-1.5 text-center text-xs font-medium">
              {CHART_TYPE_LABEL[type]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
