import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Plus, CalendarDays, CalendarRange, Flame, TrendingDown, TrendingUp, Sparkles, ChevronRight, Trophy, Leaf, Minus } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { cx, firstName, fmt, shortDate, todayStr, useFetch } from '../lib/utils.js';
import { Button, Card, EmptyState, ErrorState, PageHeader, PageLoader, ProgressBar, ProgressRing, budgetColor } from '../components/ui.jsx';
import EntryForm from '../components/EntryForm.jsx';
import EntryList from '../components/EntryList.jsx';

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

function Trend({ current, previous, label }) {
  if (!previous || previous <= 0) return <span className="text-xs font-medium text-slate-400">{label}</span>;
  const pct = Math.round(((current - previous) / previous) * 100);
  const Icon = pct < 0 ? TrendingDown : pct > 0 ? TrendingUp : Minus;
  return (
    <span className={cx('inline-flex items-center gap-1 text-xs font-bold', pct <= 0 ? 'text-emerald-600' : 'text-rose-500')}>
      <Icon size={14} />
      {Math.abs(pct) > 999 ? '999+' : Math.abs(pct)}% <span className="font-medium text-slate-400">{label}</span>
    </span>
  );
}

function StatCard({ icon: Icon, tint, label, value, unit, children }) {
  return (
    <Card className="!p-4 sm:!p-5">
      <div className="flex items-center gap-2.5">
        <span className={cx('flex h-9 w-9 items-center justify-center rounded-xl', tint)}>
          <Icon size={18} />
        </span>
        <span className="text-sm font-semibold text-slate-500">{label}</span>
      </div>
      <p className="mt-3 text-[26px] font-extrabold leading-none text-slate-900 sm:text-3xl">
        {value}
        {unit && <span className="ml-1 text-sm font-semibold text-slate-400">{unit}</span>}
      </p>
      <div className="mt-2 min-h-[18px]">{children}</div>
    </Card>
  );
}

function ChartTip({ active, payload, label, unit = 'kg CO₂e' }) {
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

export default function Dashboard() {
  const { user, meta } = useAuth();
  const today = todayStr();
  const stats = useFetch(`/stats?today=${today}`);
  const recent = useFetch('/items?limit=5');
  const [range, setRange] = useState(14);
  const [adding, setAdding] = useState(false);

  const refresh = () => Promise.all([stats.reload(), recent.reload()]);
  const s = stats.data;

  const chartData = useMemo(() => (s ? s.series.slice(-range).map((d) => ({ ...d, label: shortDate(d.date) })) : []), [s, range]);

  const header = (
    <PageHeader
      title={`${greeting()}, ${firstName(user.full_name)} 👋`}
      subtitle={new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
      action={
        <Button onClick={() => setAdding(true)} disabled={!meta}>
          <Plus size={18} /> Log activity
        </Button>
      }
    />
  );

  if (stats.loading && !s) return <>{header}<PageLoader /></>;
  if (stats.error && !s) return <>{header}<ErrorState message={stats.error} onRetry={stats.retry} /></>;

  const pct = s.month.pct;
  const ringColor = budgetColor(pct);
  const remaining = s.month.target - s.month.kg;
  const hasData = s.game.entries > 0;

  return (
    <>
      {header}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard icon={Leaf} tint="bg-emerald-50 text-emerald-600" label="Today" value={fmt(s.today.kg)} unit="kg CO₂e">
          <Trend current={s.today.kg} previous={s.today.yesterdayKg} label="vs yesterday" />
        </StatCard>
        <StatCard icon={CalendarDays} tint="bg-sky-50 text-sky-600" label="Last 7 days" value={fmt(s.week.kg)} unit="kg">
          <Trend current={s.week.kg} previous={s.week.prevKg} label="vs prior week" />
        </StatCard>
        <StatCard icon={CalendarRange} tint="bg-violet-50 text-violet-600" label="This month" value={fmt(s.month.kg)} unit="kg">
          <Trend current={s.month.kg} previous={s.month.lastMonthKg} label="vs last month" />
        </StatCard>
        <StatCard icon={Flame} tint="bg-amber-50 text-amber-600" label="Streak" value={s.game.streak} unit={s.game.streak === 1 ? 'day' : 'days'}>
          <span className="text-xs font-medium text-slate-400">{fmt(s.game.points, 0)} eco-points</span>
        </StatCard>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Trend chart */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="section-title">Daily carbon footprint</h2>
              <p className="text-sm text-slate-500">kg CO₂e per day</p>
            </div>
            <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-bold">
              {[7, 14, 30].map((n) => (
                <button key={n} onClick={() => setRange(n)} className={cx('rounded-lg px-2.5 py-1.5 transition', range === n ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500')}>
                  {n}d
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 h-56 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="co2Fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#eef2f6" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={48} allowDecimals={false} />
                <Tooltip content={<ChartTip />} cursor={{ stroke: '#10b981', strokeDasharray: '4 4' }} />
                <Area type="monotone" dataKey="kg" stroke="#10b981" strokeWidth={2.5} fill="url(#co2Fill)" dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Monthly budget */}
        <Card className="flex flex-col">
          <h2 className="section-title">Monthly carbon budget</h2>
          <p className="text-sm text-slate-500">Target {fmt(s.month.target, 0)} kg CO₂e</p>
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-4">
            <ProgressRing value={pct} size={156} stroke={14} color={ringColor}>
              <span className="text-3xl font-extrabold text-slate-900">{fmt(pct, 0)}%</span>
              <span className="text-xs font-semibold text-slate-400">of budget used</span>
            </ProgressRing>
            <p className="text-center text-sm text-slate-600">
              {remaining >= 0 ? (
                <>
                  <b className="text-emerald-600">{fmt(remaining)} kg</b> left this month
                </>
              ) : (
                <>
                  <b className="text-rose-500">{fmt(-remaining)} kg</b> over your target
                </>
              )}
              <br />
              <span className="text-xs text-slate-400">Projected month end: {fmt(s.month.projectedKg)} kg</span>
            </p>
          </div>
          <Link to="/profile" className="text-center text-sm font-bold text-emerald-600 hover:text-emerald-700">
            Adjust target
          </Link>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Category breakdown */}
        <Card className="flex flex-col">
          <h2 className="section-title">Where it comes from</h2>
          <p className="text-sm text-slate-500">This month by category</p>
          {s.byCategory.length ? (
            <div className="my-auto flex flex-col items-center gap-4 pt-3 sm:flex-row">
              <div className="relative h-44 w-44 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={s.byCategory} dataKey="kg" nameKey="label" innerRadius={54} outerRadius={80} paddingAngle={3} strokeWidth={0}>
                      {s.byCategory.map((c) => (
                        <Cell key={c.key} fill={c.color} />
                      ))}
                    </Pie>
                    <Tooltip content={({ active, payload }) => (active && payload?.length ? <ChartTip active payload={payload} label={payload[0].name} /> : null)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-extrabold text-slate-900">{fmt(s.month.kg)}</span>
                  <span className="text-[11px] font-semibold text-slate-400">kg CO₂e</span>
                </div>
              </div>
              <ul className="w-full flex-1 space-y-2.5">
                {s.byCategory.map((c) => (
                  <li key={c.key}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 font-semibold text-slate-700">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                        {c.label}
                      </span>
                      <span className="font-bold text-slate-800">
                        {fmt(c.kg)} kg <span className="font-medium text-slate-400">· {s.month.kg > 0 ? Math.round((c.kg / s.month.kg) * 100) : 0}%</span>
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full" style={{ width: `${s.month.kg > 0 ? (c.kg / s.month.kg) * 100 : 0}%`, background: c.color }} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <EmptyState title="No emissions logged this month" text="Log a commute, a meal or your electricity bill to see your breakdown." />
          )}
        </Card>

        {/* Recent activity */}
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="section-title">Recent activity</h2>
              <p className="text-sm text-slate-500">Your latest entries</p>
            </div>
            <Link to="/tracker" className="inline-flex items-center text-sm font-bold text-emerald-600 hover:text-emerald-700">
              View all <ChevronRight size={16} />
            </Link>
          </div>
          {recent.data?.items?.length ? (
            <EntryList items={recent.data.items} meta={meta} onChanged={refresh} />
          ) : recent.loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-2xl bg-slate-100" />
              ))}
            </div>
          ) : recent.error ? (
            <p className="py-6 text-center text-sm text-slate-500">{recent.error}</p>
          ) : (
            <EmptyState
              title="Nothing logged yet"
              text="Your first entry takes ten seconds."
              action={
                <Button size="sm" onClick={() => setAdding(true)} disabled={!meta}>
                  <Plus size={16} /> Log your first activity
                </Button>
              }
            />
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Level */}
        <Card>
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 to-orange-400 text-white shadow-lg shadow-amber-200">
              <Trophy size={26} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Level {s.game.level}</p>
              <p className="truncate text-lg font-extrabold text-slate-900">{s.game.levelName}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-extrabold text-emerald-600">{fmt(s.game.points, 0)}</p>
              <p className="text-xs font-semibold text-slate-400">eco-points</p>
            </div>
          </div>
          <ProgressBar value={s.game.levelProgressPct} className="mt-4" color="bg-gradient-to-r from-emerald-400 to-teal-500" />
          <p className="mt-2 text-xs text-slate-500">
            {s.game.nextLevelAt ? `${fmt(s.game.nextLevelAt - s.game.points, 0)} points to ${s.game.nextLevelName}` : 'You reached the highest level. Legend!'}
            {' · '}
            {s.game.badges.filter((b) => b.earned).length}/{s.game.badges.length} badges
          </p>
        </Card>

        {/* AI coach CTA */}
        <Link to="/insights" className="group relative block overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500 via-emerald-500 to-teal-600 p-5 text-white shadow-glow sm:p-6">
          <div className="absolute -right-8 -top-10 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
          <div className="relative flex h-full flex-col justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-bold backdrop-blur">
                <Sparkles size={14} /> AI eco-coach
              </span>
              <p className="mt-3 text-xl font-extrabold leading-snug">
                {hasData ? 'Get personalised tips based on what you logged' : 'Log a few activities, then ask your AI coach for a plan'}
              </p>
              <p className="mt-1 text-sm text-emerald-50">Data-driven ideas to cut energy waste and switch to greener alternatives.</p>
            </div>
            <span className="inline-flex items-center gap-1 text-sm font-bold">
              Open AI insights <ChevronRight size={16} className="transition group-hover:translate-x-1" />
            </span>
          </div>
        </Link>
      </div>

      <EntryForm open={adding} meta={meta} onClose={() => setAdding(false)} onSaved={refresh} />
    </>
  );
}
