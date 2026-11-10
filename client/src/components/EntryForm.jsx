import { useMemo, useState } from 'react';
import { Leaf } from 'lucide-react';
import { api } from '../lib/api.js';
import { catStyle, cx, fmt, todayStr } from '../lib/utils.js';
import { useToast } from '../context/ToastContext.jsx';
import { Button, Field, Modal } from './ui.jsx';

/**
 * Add / edit a logged activity.
 *  - `item`   existing entry to edit (optional)
 *  - `preset` { category, subtype } to pre-select when adding (optional)
 *  - `only`   list of category keys to offer (optional)
 */
export default function EntryForm({ open, onClose, onSaved, meta, item, preset, only }) {
  return (
    <Modal open={open} onClose={onClose} title={item ? 'Edit entry' : 'Log an activity'} subtitle="We estimate the CO₂e for you automatically.">
      {open && meta && <FormBody key={item?.id || 'new'} meta={meta} item={item} preset={preset} only={only} onClose={onClose} onSaved={onSaved} />}
    </Modal>
  );
}

function FormBody({ meta, item, preset, only, onClose, onSaved }) {
  const toast = useToast();
  const cats = meta.categories;
  const catKeys = useMemo(() => Object.keys(cats).filter((k) => !only || only.includes(k) || k === item?.category), [cats, only, item]);

  const initialCat = item?.category && cats[item.category] ? item.category : preset?.category && cats[preset.category] ? preset.category : catKeys[0];
  const initialSub = item?.subtype && cats[initialCat].subtypes[item.subtype]
    ? item.subtype
    : preset?.subtype && cats[initialCat].subtypes[preset.subtype]
      ? preset.subtype
      : Object.keys(cats[initialCat].subtypes)[0];

  const [category, setCategory] = useState(initialCat);
  const [subtype, setSubtype] = useState(initialSub);
  const [quantity, setQuantity] = useState(item ? String(item.quantity) : '');
  const [entryDate, setEntryDate] = useState(item?.entry_date || todayStr());
  const [title, setTitle] = useState(item && item.title !== cats[item.category]?.subtypes[item.subtype]?.label ? item.title : '');
  const [description, setDescription] = useState(item?.description || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const sub = cats[category].subtypes[subtype];
  const qty = Number(quantity);
  const estimate = Number.isFinite(qty) && qty > 0 ? qty * sub.factor : 0;

  const pickCategory = (key) => {
    setCategory(key);
    setSubtype(Object.keys(cats[key].subtypes)[0]);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!Number.isFinite(qty) || qty <= 0) return setError(`Enter an amount in ${sub.unit} greater than 0.`);
    if (!entryDate) return setError('Please pick a date.');
    if (entryDate > todayStr()) return setError('The date cannot be in the future.');
    setSaving(true);
    try {
      const body = { category, subtype, quantity: qty, entry_date: entryDate, title: title.trim(), description: description.trim() };
      const data = item ? await api(`/items/${item.id}`, { method: 'PUT', body }) : await api('/items', { method: 'POST', body });
      toast(item ? 'Entry updated' : `Logged! ${fmt(data.item.co2_kg)} kg CO₂e added`);
      await onSaved?.(data.item);
      onClose();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {catKeys.length > 1 && (
        <div>
          <span className="label">Category</span>
          <div className="grid grid-cols-3 gap-2">
            {catKeys.map((key) => {
              const S = catStyle(key);
              const active = key === category;
              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => pickCategory(key)}
                  aria-pressed={active}
                  className={cx(
                    'flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 text-xs font-semibold transition',
                    active ? 'border-emerald-400 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-100' : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-200'
                  )}
                >
                  <span className={cx('flex h-9 w-9 items-center justify-center rounded-xl', S.tint)}>
                    <S.icon size={18} />
                  </span>
                  {cats[key].label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <Field label="Activity type">
        {(id) => (
          <select id={id} className="input" value={subtype} onChange={(e) => setSubtype(e.target.value)}>
            {Object.entries(cats[category].subtypes).map(([key, s]) => (
              <option key={key} value={key}>
                {s.label}
              </option>
            ))}
          </select>
        )}
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={`Amount (${sub.unit})`}>
          {(id) => (
            <input
              id={id}
              className="input"
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              placeholder="0"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              autoFocus={!item && typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches}
              required
            />
          )}
        </Field>
        <Field label="Date">
          {(id) => <input id={id} className="input" type="date" max={todayStr()} value={entryDate} onChange={(e) => setEntryDate(e.target.value)} required />}
        </Field>
      </div>

      <Field label="Title (optional)">
        {(id) => <input id={id} className="input" maxLength={120} placeholder={sub.label} value={title} onChange={(e) => setTitle(e.target.value)} />}
      </Field>

      <Field label="Notes (optional)">
        {(id) => (
          <textarea id={id} className="input min-h-[72px] resize-y" maxLength={500} placeholder="e.g. office commute, October bill…" value={description} onChange={(e) => setDescription(e.target.value)} />
        )}
      </Field>

      <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium text-emerald-800">
          <Leaf size={16} /> Estimated footprint
        </div>
        <div className="text-right">
          <span className="text-xl font-extrabold text-emerald-700">{fmt(estimate)}</span>
          <span className="ml-1 text-sm font-semibold text-emerald-700">kg CO₂e</span>
          {sub.eco && <p className="text-xs font-semibold text-emerald-600">Low-carbon choice · bonus points</p>}
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm font-medium text-rose-600">
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2.5 pt-1 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          {item ? 'Save changes' : 'Save entry'}
        </Button>
      </div>
    </form>
  );
}
