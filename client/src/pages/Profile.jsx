import { useState } from 'react';
import { LogOut, Trophy, Flame, Leaf, ListChecks, Lock } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { cx, fmt, initials, todayStr, useFetch } from '../lib/utils.js';
import { Button, Card, Field, PageHeader, ProgressBar, Skeleton } from '../components/ui.jsx';

export default function Profile() {
  const { user, setUser, logout } = useAuth();
  const toast = useToast();
  const stats = useFetch(`/stats?today=${todayStr()}`);
  const [name, setName] = useState(user.full_name || '');
  const [target, setTarget] = useState(String(user.targets?.carbon_kg ?? 200));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const dirty = name.trim() !== (user.full_name || '') || Number(target) !== Number(user.targets?.carbon_kg);

  const save = async (e) => {
    e.preventDefault();
    setError('');
    const n = Number(target);
    if (!name.trim()) return setError('Name cannot be empty.');
    if (!Number.isFinite(n) || n <= 0) return setError('Monthly carbon target must be a number greater than 0.');
    setSaving(true);
    try {
      const d = await api('/profile', { method: 'PUT', body: { full_name: name.trim(), targets: { carbon_kg: n } } });
      setUser(d.user);
      setName(d.user.full_name);
      setTarget(String(d.user.targets.carbon_kg));
      toast('Profile saved');
      stats.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const g = stats.data?.game;

  return (
    <>
      <PageHeader title="Profile" subtitle="Your account, goals and achievements." />

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <div className="flex items-center gap-4">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-xl font-extrabold text-white shadow-glow">
                {initials(user.full_name)}
              </span>
              <div className="min-w-0">
                <p className="truncate text-lg font-extrabold text-slate-900">{user.full_name}</p>
                <p className="truncate text-sm text-slate-500">{user.email}</p>
                {user.created_at && (
                  <p className="text-xs text-slate-400">Member since {new Date(user.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</p>
                )}
              </div>
            </div>

            <form onSubmit={save} className="mt-5 space-y-4" noValidate>
              <Field label="Full name">{(id) => <input id={id} className="input" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
              <Field label="Email">
                {(id) => (
                  <div className="relative">
                    <input id={id} className="input cursor-not-allowed !bg-slate-50 pr-10 text-slate-500" value={user.email} disabled readOnly />
                    <Lock size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  </div>
                )}
              </Field>
              <Field label="Monthly carbon target (kg CO₂e)" hint="Used for the budget ring on your dashboard.">
                {(id) => <input id={id} className="input" type="number" inputMode="decimal" min="1" step="any" value={target} onChange={(e) => setTarget(e.target.value)} />}
              </Field>
              {error && (
                <p role="alert" className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm font-medium text-rose-600">
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full" loading={saving} disabled={!dirty}>
                Save changes
              </Button>
            </form>
          </Card>

          <Button variant="dangerSoft" className="w-full" onClick={logout}>
            <LogOut size={18} /> Log out
          </Button>
        </div>

        <div className="space-y-4 lg:col-span-3">
          <Card>
            {g ? (
              <>
                <div className="flex items-center gap-4">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 to-orange-400 text-white shadow-lg shadow-amber-200">
                    <Trophy size={26} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Level {g.level}</p>
                    <p className="truncate text-xl font-extrabold text-slate-900">{g.levelName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-extrabold text-emerald-600">{fmt(g.points, 0)}</p>
                    <p className="text-xs font-semibold text-slate-400">eco-points</p>
                  </div>
                </div>
                <ProgressBar value={g.levelProgressPct} className="mt-4" color="bg-gradient-to-r from-emerald-400 to-teal-500" />
                <p className="mt-2 text-xs text-slate-500">
                  {g.nextLevelAt ? `${fmt(g.nextLevelAt - g.points, 0)} points to ${g.nextLevelName}` : 'Highest level reached!'} · 10 pts per entry, +5 for low-carbon choices, 20 per challenge check-in
                </p>
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { icon: Flame, label: 'Day streak', value: g.streak, tint: 'text-amber-500' },
                    { icon: ListChecks, label: 'Entries', value: g.entries, tint: 'text-sky-500' },
                    { icon: Leaf, label: 'Green choices', value: g.ecoEntries, tint: 'text-emerald-500' },
                    { icon: Trophy, label: 'kg saved in challenges', value: fmt(g.savedKg), tint: 'text-violet-500' },
                  ].map((x) => (
                    <div key={x.label} className="rounded-2xl bg-slate-50 p-3">
                      <x.icon size={18} className={x.tint} />
                      <p className="mt-1.5 text-xl font-extrabold text-slate-900">{x.value}</p>
                      <p className="text-xs font-medium leading-tight text-slate-500">{x.label}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : stats.error ? (
              <p className="py-6 text-center text-sm text-slate-500">{stats.error}</p>
            ) : (
              <Skeleton className="h-44" />
            )}
          </Card>

          <Card>
            <h2 className="section-title">Badges</h2>
            <p className="mb-4 text-sm text-slate-500">{g ? `${g.badges.filter((b) => b.earned).length} of ${g.badges.length} earned` : 'Loading…'}</p>
            {g ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {g.badges.map((b) => (
                  <div
                    key={b.key}
                    className={cx(
                      'flex flex-col items-center rounded-2xl border p-3 text-center transition',
                      b.earned ? 'border-emerald-200 bg-gradient-to-b from-emerald-50 to-white' : 'border-slate-100 bg-slate-50 opacity-60 grayscale'
                    )}
                  >
                    <span className="text-3xl" aria-hidden="true">
                      {b.emoji}
                    </span>
                    <p className="mt-1.5 text-sm font-bold text-slate-800">{b.label}</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{b.desc}</p>
                    <span className={cx('mt-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase', b.earned ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500')}>
                      {b.earned ? 'Earned' : 'Locked'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <Skeleton className="h-40" />
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
