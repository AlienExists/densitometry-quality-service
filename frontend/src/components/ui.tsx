import { useState, type ReactNode } from 'react';

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: SegmentedProps<T>) {
  return (
    <div className={`segmented ${className ?? ''}`} role="tablist" aria-label={label}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            className={selected ? 'segmented__item segmented__item--active' : 'segmented__item'}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

interface ToggleProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}

export function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={checked ? 'toggle toggle--on' : 'toggle'}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle__thumb" />
    </button>
  );
}

interface PageHeadingProps {
  title: string;
  subtitle?: ReactNode;
}

export function PageHeading({ title, subtitle }: PageHeadingProps) {
  return (
    <div className="page-heading">
      <h1 className="page-heading__title">{title}</h1>
      {subtitle && <p className="page-heading__subtitle">{subtitle}</p>}
    </div>
  );
}

interface ArtworkProps {
  src: string;
  alt: string;
  className?: string;
}

export function Artwork({ src, alt, className }: ArtworkProps) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}

interface ProgressBarProps {
  value?: number;
  label: string;
}

export function ProgressBar({ value, label }: ProgressBarProps) {
  const indeterminate = value === undefined;
  return (
    <div
      className={indeterminate ? 'progress progress--indeterminate' : 'progress'}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : value}
    >
      <span className="progress__fill" style={indeterminate ? undefined : { width: `${value}%` }} />
    </div>
  );
}
