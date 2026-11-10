import { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X, RefreshCw, Leaf } from 'lucide-react';
import { cx } from '../lib/utils.js';

/* --------------------------------- Button -------------------------------- */
const VARIANTS = {
  primary: 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-glow hover:brightness-105 active:brightness-95',
  secondary: 'bg-white text-slate-700 border border-slate-200 hover:border-emerald-300 hover:text-emerald-700',
  soft: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
  ghost: 'text-slate-500 hover:bg-slate-100 hover:text-slate-700',
  danger: 'bg-rose-500 text-white hover:bg-rose-600',
  dangerSoft: 'bg-rose-50 text-rose-600 hover:bg-rose-100',
};
const SIZES = {
  sm: 'h-9 px-3.5 text-sm rounded-xl gap-1.5',
  md: 'h-11 px-5 text-[15px] rounded-2xl gap-2',
  lg: 'h-12 px-6 text-base rounded-2xl gap-2',
};

export function Button({ variant = 'primary', size = 'md', loading = false, disabled, className, children, type = 'button', ...rest }) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cx(
        'inline-flex select-none items-center justify-center font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...rest}
    >
      {loading && <Loader2 className="animate-spin" size={size === 'sm' ? 15 : 18} />}
      {children}
    </button>
  );
}

export function IconButton({ label, className, children, ...rest }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx('inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50', className)}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ---------------------------------- Card --------------------------------- */
export function Card({ className, children, glass = false, ...rest }) {
  return (
    <div className={cx(glass ? 'glass min-w-0 rounded-3xl' : 'card', 'p-5 sm:p-6', className)} {...rest}>
      {children}
    </div>
  );
}

/* --------------------------------- Fields -------------------------------- */
export function Field({ label, hint, children, className }) {
  const id = useId();
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="label">
          {label}
        </label>
      )}
      {typeof children === 'function' ? children(id) : children}
      {hint && <p className="mt-1.5 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

/* --------------------------------- Modal --------------------------------- */
export function Modal({ open, onClose, title, subtitle, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex max-h-[92dvh] w-full animate-pop flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl sm:max-w-lg sm:rounded-[28px]"
      >
        <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-5 sm:px-6 sm:pt-6">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
          </div>
          <IconButton label="Close" onClick={onClose} className="-mr-1.5 -mt-1">
            <X size={18} />
          </IconButton>
        </div>
        <div className="overflow-y-auto px-5 pb-6 sm:px-6" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Delete', loading, onConfirm, onClose }) {
  return (
    <Modal open={open} onClose={loading ? undefined : onClose} title={title}>
      <p className="text-[15px] leading-relaxed text-slate-600">{message}</p>
      <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

/* ------------------------------ Progress ring ----------------------------- */
export function ProgressRing({ value = 0, size = 120, stroke = 10, color = '#10b981', track = '#e2e8f0', children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (pct / 100) * c}
          style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.3s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

export function ProgressBar({ value = 0, color = 'bg-emerald-500', className }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className={cx('h-2.5 w-full overflow-hidden rounded-full bg-slate-100', className)} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cx('h-full rounded-full transition-all duration-700', color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** green -> amber -> red as usage approaches / passes a budget */
export const budgetColor = (pct) => (pct >= 100 ? '#f43f5e' : pct >= 80 ? '#f59e0b' : '#10b981');

/* ------------------------------ Status blocks ----------------------------- */
export function Skeleton({ className }) {
  return <div className={cx('animate-pulse rounded-2xl bg-slate-200/70', className)} />;
}

export function PageLoader({ cards = 4 }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-9 w-56" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {Array.from({ length: cards }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <Card className="flex flex-col items-center gap-3 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
        <RefreshCw size={22} />
      </div>
      <p className="max-w-sm text-sm text-slate-600">{message || 'Something went wrong.'}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </Card>
  );
}

export function EmptyState({ icon: Icon = Leaf, title, text, action }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      <div className="mb-1 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500">
        <Icon size={26} />
      </div>
      <p className="font-semibold text-slate-800">{title}</p>
      {text && <p className="max-w-xs text-sm text-slate-500">{text}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3 sm:mb-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-extrabold text-slate-900 sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500 sm:text-[15px]">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Logo({ size = 40, withText = true }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="flex items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-glow"
        style={{ width: size, height: size }}
      >
        <Leaf size={size * 0.52} strokeWidth={2.4} />
      </div>
      {withText && <span className="text-xl font-extrabold tracking-tight text-slate-900">GreenTrack</span>}
    </div>
  );
}
