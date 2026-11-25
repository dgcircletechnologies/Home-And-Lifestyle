"use client";

import { Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { useState } from 'react';

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
};

export function FormField({ label, hint, error, id, className = '', ...props }: FieldProps) {
  const descriptionId = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return <div className="grid gap-2">
    <label className="text-sm font-semibold text-[var(--hl-ink)]" htmlFor={id}>{label}</label>
    <input id={id} className={`hl-input ${error ? 'border-[var(--hl-error)]' : ''} ${className}`} aria-invalid={Boolean(error)} aria-describedby={descriptionId} {...props} />
    {hint && !error && <p id={`${id}-hint`} className="text-xs leading-5 text-[var(--hl-muted)]">{hint}</p>}
    {error && <p id={`${id}-error`} className="flex gap-2 text-sm leading-5 text-[var(--hl-error)]"><span aria-hidden="true">!</span>{error}</p>}
  </div>;
}

export function PasswordField({ label, hint, error, id, ...props }: FieldProps) {
  const [visible, setVisible] = useState(false);
  const descriptionId = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  const toggleLabel = id === 'confirm' ? 'confirmation' : label.toLowerCase();
  return <div className="grid gap-2">
    <label className="text-sm font-semibold text-[var(--hl-ink)]" htmlFor={id}>{label}</label>
    <div className="relative">
      <input id={id} className={`hl-input pr-12 ${error ? 'border-[var(--hl-error)]' : ''}`} type={visible ? 'text' : 'password'} aria-invalid={Boolean(error)} aria-describedby={descriptionId} {...props} />
      <button type="button" className="absolute inset-y-0 right-0 grid w-12 place-items-center text-[var(--hl-muted)] transition hover:text-[var(--hl-ink)] focus-visible:outline-none" onClick={() => setVisible(value => !value)} aria-label={visible ? `Hide ${toggleLabel}` : `Show ${toggleLabel}`} aria-pressed={visible}>
        {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
      </button>
    </div>
    {hint && !error && <p id={`${id}-hint`} className="text-xs leading-5 text-[var(--hl-muted)]">{hint}</p>}
    {error && <p id={`${id}-error`} className="flex gap-2 text-sm leading-5 text-[var(--hl-error)]"><span aria-hidden="true">!</span>{error}</p>}
  </div>;
}

export function Button({ children, busy = false, variant = 'primary', className = '', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean; variant?: 'primary' | 'secondary' | 'text' }) {
  const styles = variant === 'primary' ? 'hl-primary-button' : variant === 'secondary' ? 'hl-secondary-button' : 'hl-text-button';
  const { disabled, ...buttonProps } = props;
  return <button className={`auth-submit-button inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--hl-radius-sm)] px-5 text-sm font-semibold transition duration-150 disabled:cursor-wait disabled:opacity-60 ${styles} ${className}`} disabled={busy || disabled} {...buttonProps}>
    {busy && <LoaderCircle className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />}{children}
  </button>;
}

export function StatusMessage({ children, tone = 'error', role = 'alert' }: { children: React.ReactNode; tone?: 'error' | 'success' | 'neutral'; role?: 'alert' | 'status' }) {
  const toneClass = tone === 'success' ? 'border-[var(--hl-success)]/30 bg-[var(--hl-success)]/10 text-[var(--hl-success)]' : tone === 'neutral' ? 'border-[var(--hl-border)] bg-[var(--hl-page)] text-[var(--hl-muted)]' : 'border-[var(--hl-error)]/25 bg-[var(--hl-error)]/10 text-[var(--hl-error)]';
  return <div role={role} className={`rounded-[var(--hl-radius-sm)] border px-4 py-3 text-sm leading-6 ${toneClass}`}>{children}</div>;
}
