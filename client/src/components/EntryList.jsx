import { useState } from 'react';
import { Pencil, Trash2, Sparkles, Loader2 } from 'lucide-react';
import { api } from '../lib/api.js';
import { catStyle, cx, fmt, friendlyDate, unitLabel } from '../lib/utils.js';
import { useToast } from '../context/ToastContext.jsx';
import { ConfirmDialog, IconButton } from './ui.jsx';
import EntryForm from './EntryForm.jsx';

/**
 * List of the user's logged entries with edit / delete / AI-summary actions.
 * `onChanged` is called after any change so the parent can refresh its data.
 */
export default function EntryList({ items, meta, onChanged, grouped = false, showDate = true, only }) {
  const toast = useToast();
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(null);

  const confirmDelete = async () => {
    setDeleteBusy(true);
    try {
      await api(`/items/${deleting.id}`, { method: 'DELETE' });
      toast('Entry deleted');
      setDeleting(null);
      await onChanged?.();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setDeleteBusy(false);
    }
  };

  const summarize = async (item) => {
    setAiBusy(item.id);
    try {
      await api('/ai/generate', { method: 'POST', body: { mode: 'summarize', item_id: item.id } });
      await onChanged?.();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setAiBusy(null);
    }
  };

  const row = (it) => {
    const S = catStyle(it.category);
    const sub = meta?.categories?.[it.category]?.subtypes?.[it.subtype];
    const subLabel = sub?.label || it.subtype;
    return (
      <li key={it.id} className="group py-3.5 first:pt-0 last:pb-0">
        <div className="flex items-start gap-3">
          <span className={cx('mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl', S.tint)}>
            <S.icon size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-800">{it.title}</p>
                <p className="truncate text-sm text-slate-500">
                  {it.title !== subLabel && `${subLabel} · `}
                  {fmt(it.quantity)} {unitLabel(it.quantity, it.unit)}
                  {showDate && !grouped && ` · ${friendlyDate(it.entry_date)}`}
                </p>
              </div>
              <span
                className={cx(
                  'shrink-0 rounded-full px-2.5 py-1 text-xs font-bold',
                  sub?.eco ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'
                )}
              >
                {fmt(it.co2_kg)} kg
              </span>
            </div>
            {it.description && <p className="mt-1 text-sm text-slate-500">{it.description}</p>}
            {it.ai_summary && (
              <div className="mt-2 flex gap-2 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 px-3 py-2.5 text-sm leading-relaxed text-emerald-900">
                <Sparkles size={15} className="mt-0.5 shrink-0 text-emerald-500" />
                <span>{it.ai_summary}</span>
              </div>
            )}
            <div className="-ml-2 mt-1 flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => summarize(it)}
                disabled={aiBusy === it.id}
                className="inline-flex h-8 items-center gap-1.5 rounded-xl px-2 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-60"
              >
                {aiBusy === it.id ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {aiBusy === it.id ? 'Thinking…' : it.ai_summary ? 'Refresh AI summary' : 'AI summary'}
              </button>
              <IconButton label="Edit entry" onClick={() => setEditing(it)} className="h-8 w-8">
                <Pencil size={15} />
              </IconButton>
              <IconButton label="Delete entry" onClick={() => setDeleting(it)} className="h-8 w-8 hover:bg-rose-50 hover:text-rose-600">
                <Trash2 size={15} />
              </IconButton>
            </div>
          </div>
        </div>
      </li>
    );
  };

  let body;
  if (grouped) {
    const groups = [];
    for (const it of items) {
      const last = groups[groups.length - 1];
      if (last && last.date === it.entry_date) last.items.push(it);
      else groups.push({ date: it.entry_date, items: [it] });
    }
    body = (
      <div className="space-y-5">
        {groups.map((g) => (
          <section key={g.date}>
            <div className="mb-2.5 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-500">{friendlyDate(g.date)}</h3>
              <span className="text-xs font-semibold text-slate-400">{fmt(g.items.reduce((s, i) => s + Number(i.co2_kg || 0), 0))} kg CO₂e</span>
            </div>
            <ul className="card divide-y divide-slate-100 p-4 sm:p-5">{g.items.map(row)}</ul>
          </section>
        ))}
      </div>
    );
  } else {
    body = <ul className="divide-y divide-slate-100">{items.map(row)}</ul>;
  }

  return (
    <>
      {body}
      <EntryForm open={Boolean(editing)} item={editing} meta={meta} only={only} onClose={() => setEditing(null)} onSaved={onChanged} />
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete this entry?"
        message={deleting ? `"${deleting.title}" (${fmt(deleting.co2_kg)} kg CO₂e) will be permanently removed from your log.` : ''}
        loading={deleteBusy}
        onConfirm={confirmDelete}
        onClose={() => setDeleting(null)}
      />
    </>
  );
}
