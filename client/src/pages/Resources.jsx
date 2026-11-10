import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Zap, Droplets, Trash2, Recycle, Plus, Target, Gauge } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { cx, fmt, todayStr, useFetch } from '../lib/utils.js';
import { Button, Card, EmptyState, ErrorState, Field, Modal, PageHeader, PageLoader, ProgressRing, budgetColor } from '../components/ui.jsx';
import EntryForm from '../components/EntryForm.jsx';
import EntryList from '../components/EntryList.jsx';

const RESOURCE_CATS = ['energy', 'water', 'waste'];

const RESOURCES = [
  { key: 'electricity_kwh', label: 'Electricity', unit: 'kWh', icon: Zap, tint: 'bg-amber-50 text-amber-600', color: '#f59e0b', preset: { category: 'energy', subtype: 'electricity' }, action: 'Log bill' },
  { key: 'water_l', label: 'Water', unit: 'L', icon: Droplets, tint: 'bg-cyan-50 text-cyan-600', color: '#06b6d4', preset: { category: 'water', subtype: 'tap' }, action: 'Log usage' },
  { key: 'waste_kg', label: 'Landfill waste', unit: 'kg', icon: Trash2, tint: 'bg-violet-50 text-violet-600', color: '#8b5cf6', preset: { category: 'waste', subtype: 'landfill' }, action: 'Log waste' },
];

const METRICS = [
  { key: 'electricity_kwh', label: 'Electricity', unit: 'kWh', color: '#f59e0b', target: 'electricity_kwh' },
  { key: 'water_l', label: 'Water', unit: 'L', color: '#06b6d4', target: 'water_l' },
  { key: 'waste_kg', label: 'Landfill', unit: 'kg', color: '#8b5cf6', target: 'waste_kg' },
  { key: 'recycled_kg', label: 'Recycled', unit: 'kg', color: '#10b981' },
  { key: 'co2', label: 'CO₂e', unit: 'kg', color: '#0ea5e9', target: 'carbon_kg' },
];

function TargetsModal({ open, onClose, targets, onSaved }) {
  return (
    <Modal open={open} onClose={onClose} title="Monthly targets" subtitle="Set goals that fit your home, campus or business.">
      {open && <TargetsForm targets={targets} onClose={onClose} onSaved={onSaved} />}
    </Modal>
  );
}

function TargetsForm({ targets, onClose, onSaved }) {
  const toast = useToast();
  const { setUser } = useAuth();
  const [form, setForm] = useState({
    electricity_kwh: String(targets.electricity_kwh),
    water_l: String(targets.water_l),
    waste_kg: String(targets.waste_kg),
    recycle_rate: String(targets.recycle_rate),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fields = [
    ['electricity_kwh', 'Electricity (kWh / month)'],
    ['water_l', 'Water (litres / month)'],
    ['waste_kg', 'Landfill waste (kg / month)'],
    ['recycle_rate', 'Recycling goal (% of waste)'],
  ];

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const payload = {};
    for (const [k, label] of fields) {
      const n = Number(form[k]);
      if (!Number.isFinite(n) || n <= 0) return setError(`${label}: enter a number greater than 0.`);
      if (k === 'recycle_rate' && n > 100) return setError('Recycling goal cannot be more than 100%.');
      payload[k] = n;
    }
    setSaving(true);
    try {
      const d = await api('/profile', { method: 'PUT', body: { targets: payload } });
      setUser(d.user);
      toast('Targets updated');
      await onSaved?.();
      onClose();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {fields.map(([k, label]) => (
          <Field key={k} label={label}>
            {(id) => (
              <input id={id} className="input" type="number" inputMode="decimal" min="0" step="any" value={form[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} />
            )}
          </Field>
        ))}
      </div>
      {error && (
        <p role="alert" className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm font-medium text-rose-600">
          {error}
        </p>
      )}
      <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" loading={saving}>
          Save targets
        </Button>
      </div>
    </form>
  );
}

function HistoryTip({ active, payload, label, unit }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-xl px-3 py-2 text-xs">
      <p className="font-semibold text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-bold text-slate-900">
        {fmt(payload[0].value)} {unit}
      </p>
    </div>
  );
}

export default function Resources() {
  const { meta } = useAuth();
  const stats = useFetch(`/stats?today=${todayStr()}`);
  const list = useFetch('/items?limit=1000');
  const [preset, setPreset] = useState(null);
  const [editTargets, setEditTargets] = useState(false);
  const [metric, setMetric] = useState('electricity_kwh');

  const refresh = () => Promise.all([stats.reload(), list.reload()]);
  const s = stats.data;

  const header = (
    <PageHeader
      title="Smart Resource Logger"
      subtitle="Log utility bills, water use and waste. Watch your progress against monthly targets."
      action={
        <Button variant="secondary" onClick={() => setEditTargets(true)} disabled={!s}>
          <Target size={18} /> Set targets
        </Button>
      }
    />
  );

  if (stats.loading && !s) return <>{header}<PageLoader /></>;
  if (stats.error && !s) return <>{header}<ErrorState message={stats.error} onRetry={stats.retry} /></>;

  const r = s.resources;
  const t = s.targets;
  const diverted = r.recycled_kg + r.composted_kg;
  const ratePct = Math.min(100, (r.recycle_rate / t.recycle_rate) * 100);
  const m = METRICS.find((x) => x.key === metric);
  const resourceItems = (list.data?.items || []).filter((it) => RESOURCE_CATS.includes(it.category)).slice(0, 8);
  const monthName = new Date().toLocaleDateString(undefined, { month: 'long' });

  return (
    <>
      {header}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:gap-4 xl:grid-cols-4">
        {RESOURCES.map((res) => {
          const used = r[res.key];
          const target = t[res.key];
          const pct = target > 0 ? (used / target) * 100 : 0;
          const left = target - used;
          return (
            <Card key={res.key} className="flex flex-col !p-5">
              <div className="flex items-center gap-2.5">
                <span className={cx('flex h-10 w-10 items-center justify-center rounded-2xl', res.tint)}>
                  <res.icon size={20} />
                </span>
                <div>
                  <p className="font-bold text-slate-800">{res.label}</p>
                  <p className="text-xs text-slate-400">{monthName}</p>
                </div>
              </div>
              <div className="flex flex-1 items-center gap-4 py-4">
                <ProgressRing value={pct} size={92} stroke={9} color={budgetColor(pct)}>
                  <span className="text-lg font-extrabold text-slate-900">{fmt(pct, 0)}%</span>
                </ProgressRing>
                <div className="min-w-0">
                  <p className="text-2xl font-extrabold leading-tight text-slate-900">
                    {fmt(used)} <span className="text-sm font-semibold text-slate-400">{res.unit}</span>
                  </p>
                  <p className="text-sm text-slate-500">of {fmt(target)} {res.unit}</p>
                  <p className={cx('mt-1 text-xs font-bold', left >= 0 ? 'text-emerald-600' : 'text-rose-500')}>
                    {left >= 0 ? `${fmt(left)} ${res.unit} left` : `${fmt(-left)} ${res.unit} over`}
                  </p>
                </div>
              </div>
              <Button variant="soft" size="sm" className="w-full" onClick={() => setPreset(res.preset)} disabled={!meta}>
                <Plus size={16} /> {res.action}
              </Button>
            </Card>
          );
        })}

        {/* Recycling - higher is better */}
        <Card className="flex flex-col !p-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <Recycle size={20} />
            </span>
            <div>
              <p className="font-bold text-slate-800">Recycling rate</p>
              <p className="text-xs text-slate-400">Goal {fmt(t.recycle_rate, 0)}%</p>
            </div>
          </div>
          <div className="flex flex-1 items-center gap-4 py-4">
            <ProgressRing value={ratePct} size={92} stroke={9} color={r.recycle_rate >= t.recycle_rate ? '#10b981' : '#f59e0b'}>
              <span className="text-lg font-extrabold text-slate-900">{fmt(r.recycle_rate, 0)}%</span>
            </ProgressRing>
            <div className="min-w-0">
              <p className="text-2xl font-extrabold leading-tight text-slate-900">
                {fmt(diverted)} <span className="text-sm font-semibold text-slate-400">kg</span>
              </p>
              <p className="text-sm text-slate-500">recycled or composted</p>
              <p className={cx('mt-1 text-xs font-bold', r.recycle_rate >= t.recycle_rate ? 'text-emerald-600' : 'text-amber-600')}>
                {diverted + r.waste_kg === 0 ? 'Log waste to see your rate' : r.recycle_rate >= t.recycle_rate ? 'Milestone reached!' : `${fmt(t.recycle_rate - r.recycle_rate, 0)}% to your goal`}
              </p>
            </div>
          </div>
          <Button variant="soft" size="sm" className="w-full" onClick={() => setPreset({ category: 'waste', subtype: 'recycled' })} disabled={!meta}>
            <Plus size={16} /> Log recycling
          </Button>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5 lg:items-start">
        <Card className="lg:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="section-title">6-month history</h2>
              <p className="text-sm text-slate-500">
                {m.label} per month ({m.unit})
              </p>
            </div>
          </div>
          <div className="no-scrollbar -mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {METRICS.map((x) => (
              <button key={x.key} onClick={() => setMetric(x.key)} className={cx('chip !px-3 !py-1 !text-xs', metric === x.key ? 'chip-on' : 'chip-off')}>
                {x.label}
              </button>
            ))}
          </div>
          <div className="mt-3 h-56 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={s.history} margin={{ top: 12, right: 6, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="#eef2f6" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={52} />
                <Tooltip content={<HistoryTip unit={m.unit} />} cursor={{ fill: '#f1f5f9' }} />
                {m.target && <ReferenceLine y={t[m.target]} stroke="#94a3b8" strokeDasharray="5 5" label={{ value: 'target', position: 'insideTopRight', fontSize: 10, fill: '#94a3b8' }} />}
                <Bar dataKey={m.key} fill={m.color} radius={[8, 8, 2, 2]} maxBarSize={44} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <h2 className="section-title">Recent resource logs</h2>
          <p className="mb-3 text-sm text-slate-500">Energy, water and waste entries</p>
          {resourceItems.length ? (
            <EntryList items={resourceItems} meta={meta} onChanged={refresh} only={RESOURCE_CATS} />
          ) : list.loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-2xl bg-slate-100" />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Gauge}
              title="No resource logs yet"
              text="Add your latest electricity bill or today's water use."
              action={
                <Button size="sm" onClick={() => setPreset({ category: 'energy', subtype: 'electricity' })} disabled={!meta}>
                  <Plus size={16} /> Log electricity
                </Button>
              }
            />
          )}
        </Card>
      </div>

      <EntryForm open={Boolean(preset)} meta={meta} preset={preset || undefined} only={RESOURCE_CATS} onClose={() => setPreset(null)} onSaved={refresh} />
      <TargetsModal open={editTargets} onClose={() => setEditTargets(false)} targets={t} onSaved={stats.reload} />
    </>
  );
}
