import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const toast = useCallback(
    (message, type = 'success') => {
      const id = nextId.current++;
      setToasts((t) => [...t.slice(-2), { id, message, type }]);
      setTimeout(() => dismiss(id), type === 'error' ? 5500 : 3200);
    },
    [dismiss]
  );
  const value = useMemo(() => toast, [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[70] flex flex-col items-center gap-2 px-3 sm:items-end sm:pr-5" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="glass pointer-events-auto flex w-full max-w-sm animate-pop items-start gap-2.5 rounded-2xl px-4 py-3 text-sm font-medium text-slate-700"
          >
            {t.type === 'error' ? (
              <AlertCircle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-rose-500" size={18} />
            ) : (
              <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-500" size={18} />
            )}
            <span className="flex-1 leading-snug">{t.message}</span>
            <button onClick={() => dismiss(t.id)} className="rounded-md p-0.5 text-slate-400 hover:text-slate-600" aria-label="Dismiss">
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
