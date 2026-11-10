import { useCallback, useEffect, useRef, useState } from 'react';
import { Car, Zap, Utensils, Trash2, Droplets, ShoppingBag, Leaf } from 'lucide-react';
import { api } from './api.js';

export const cx = (...parts) => parts.filter(Boolean).join(' ');

/* ----------------------------- dates (local) ----------------------------- */
const pad = (n) => String(n).padStart(2, '0');
export const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayStr = () => toDateStr(new Date());
export const parseDate = (s) => {
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};
export const shortDate = (s) => parseDate(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
export function friendlyDate(s) {
  const today = todayStr();
  if (s === today) return 'Today';
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (s === toDateStr(y)) return 'Yesterday';
  const d = parseDate(s);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
}

/* -------------------------------- numbers -------------------------------- */
export function fmt(n, digits) {
  const v = Number(n) || 0;
  const a = Math.abs(v);
  const d = digits ?? (a >= 100 ? 0 : a >= 10 ? 1 : 2);
  return v.toLocaleString(undefined, { maximumFractionDigits: d });
}
/** "1 meal" instead of "1 meals" */
export const unitLabel = (qty, unit) => (Number(qty) === 1 && (unit === 'meals' || unit === 'items') ? unit.slice(0, -1) : unit);
export const firstName = (full) => String(full || '').trim().split(/\s+/)[0] || 'there';
export const initials = (full) =>
  String(full || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('') || '?';

/* ---------------------------- category visuals --------------------------- */
export const CAT_STYLE = {
  commute: { icon: Car, tint: 'bg-sky-50 text-sky-600', dot: 'bg-sky-500' },
  energy: { icon: Zap, tint: 'bg-amber-50 text-amber-600', dot: 'bg-amber-500' },
  food: { icon: Utensils, tint: 'bg-rose-50 text-rose-600', dot: 'bg-rose-500' },
  waste: { icon: Trash2, tint: 'bg-violet-50 text-violet-600', dot: 'bg-violet-500' },
  water: { icon: Droplets, tint: 'bg-cyan-50 text-cyan-600', dot: 'bg-cyan-500' },
  shopping: { icon: ShoppingBag, tint: 'bg-pink-50 text-pink-600', dot: 'bg-pink-500' },
};
export const catStyle = (key) => CAT_STYLE[key] || { icon: Leaf, tint: 'bg-emerald-50 text-emerald-600', dot: 'bg-emerald-500' };

/* ------------------------------ data fetching ----------------------------- */
/** Loads `path` on mount / when it changes. `reload()` refreshes quietly without flashing skeletons. */
export function useFetch(path) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const reqId = useRef(0);

  const load = useCallback(
    async (silent = false) => {
      const id = ++reqId.current;
      if (!silent) setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const data = await api(path);
        if (id === reqId.current) setState({ data, loading: false, error: null });
      } catch (e) {
        if (id === reqId.current) setState((s) => ({ data: silent ? s.data : null, loading: false, error: e.message }));
      }
    },
    [path]
  );

  useEffect(() => {
    load(false);
    return () => {
      reqId.current++;
    };
  }, [load]);

  const reload = useCallback(() => load(true), [load]);
  const retry = useCallback(() => load(false), [load]);
  return { ...state, reload, retry };
}
