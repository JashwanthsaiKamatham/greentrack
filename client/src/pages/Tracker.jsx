import { useMemo, useState } from 'react';
import { Plus, Search, ClipboardList } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { catStyle, cx, fmt, useFetch } from '../lib/utils.js';
import { Button, Card, EmptyState, ErrorState, PageHeader, Skeleton } from '../components/ui.jsx';
import EntryForm from '../components/EntryForm.jsx';
import EntryList from '../components/EntryList.jsx';

export default function Tracker() {
  const { meta } = useAuth();
  const { data, loading, error, reload, retry } = useFetch('/items?limit=1000');
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);

  const items = data?.items || [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      if (category !== 'all' && it.category !== category) return false;
      if (!q) return true;
      const subLabel = meta?.categories?.[it.category]?.subtypes?.[it.subtype]?.label || '';
      return `${it.title} ${it.description || ''} ${subLabel}`.toLowerCase().includes(q);
    });
  }, [items, category, query, meta]);

  const totalKg = filtered.reduce((s, it) => s + Number(it.co2_kg || 0), 0);
  const cats = meta ? Object.entries(meta.categories) : [];

  return (
    <>
      <PageHeader
        title="Carbon Tracker"
        subtitle="Log commutes, energy, food, waste, water and shopping. Edit or delete anytime."
        action={
          <Button onClick={() => setAdding(true)} disabled={!meta}>
            <Plus size={18} /> Add entry
          </Button>
        }
      />

      <div className="mb-4 space-y-3">
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input !rounded-2xl !pl-10" placeholder="Search your entries…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search entries" />
        </div>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
          <button onClick={() => setCategory('all')} className={cx('chip', category === 'all' ? 'chip-on' : 'chip-off')}>
            All
          </button>
          {cats.map(([key, c]) => {
            const S = catStyle(key);
            return (
              <button key={key} onClick={() => setCategory(key)} className={cx('chip', category === key ? 'chip-on' : 'chip-off')}>
                <S.icon size={15} /> {c.label}
              </button>
            );
          })}
        </div>
      </div>

      {loading && !data ? (
        <div className="space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : error && !data ? (
        <ErrorState message={error} onRetry={retry} />
      ) : !items.length ? (
        <Card>
          <EmptyState
            icon={ClipboardList}
            title="Your log is empty"
            text="Add your first activity to start measuring your footprint."
            action={
              <Button onClick={() => setAdding(true)} disabled={!meta}>
                <Plus size={18} /> Add your first entry
              </Button>
            }
          />
        </Card>
      ) : !filtered.length ? (
        <Card>
          <EmptyState icon={Search} title="No matching entries" text="Try a different search or category." />
        </Card>
      ) : (
        <>
          <p className="mb-3 text-sm text-slate-500">
            <b className="text-slate-700">{filtered.length}</b> {filtered.length === 1 ? 'entry' : 'entries'} · <b className="text-slate-700">{fmt(totalKg)} kg CO₂e</b> total
          </p>
          <EntryList items={filtered} meta={meta} onChanged={reload} grouped />
        </>
      )}

      <EntryForm open={adding} meta={meta} preset={category !== 'all' ? { category } : undefined} onClose={() => setAdding(false)} onSaved={reload} />
    </>
  );
}
