import { useState } from 'react';
import { Plus, Users, CheckCircle2, Leaf, Trophy, Pencil, Trash2, Sparkles, Check, LogOut, CalendarClock, Medal } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { cx, fmt, todayStr, useFetch } from '../lib/utils.js';
import { Button, Card, ConfirmDialog, EmptyState, ErrorState, Field, IconButton, Modal, PageHeader, PageLoader, ProgressBar } from '../components/ui.jsx';

const FALLBACK_CATS = { general: { label: 'General', emoji: '🌍' } };

function ChallengeModal({ open, onClose, challenge, cats, onSaved }) {
  return (
    <Modal open={open} onClose={onClose} title={challenge ? 'Edit challenge' : 'Create a challenge'} subtitle="Invite your community to build a green habit together.">
      {open && <ChallengeForm key={challenge?.id || 'new'} challenge={challenge} cats={cats} onClose={onClose} onSaved={onSaved} />}
    </Modal>
  );
}

function ChallengeForm({ challenge, cats, onClose, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({
    title: challenge?.title || '',
    description: challenge?.description || '',
    category: challenge?.category || 'general',
    duration_days: String(challenge?.duration_days ?? 7),
    co2_per_checkin: String(challenge?.co2_per_checkin ?? 1),
    goal_checkins: String(challenge?.goal_checkins ?? 100),
  });
  const [theme, setTheme] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const generate = async () => {
    setAiBusy(true);
    setError('');
    try {
      const d = await api('/ai/generate', { method: 'POST', body: { mode: 'challenge_idea', prompt: theme.trim() } });
      setForm({
        title: d.idea.title,
        description: d.idea.description,
        category: d.idea.category,
        duration_days: String(d.idea.duration_days),
        co2_per_checkin: String(d.idea.co2_per_checkin),
        goal_checkins: String(d.idea.goal_checkins),
      });
      toast('AI drafted a challenge. Review and save!');
    } catch (err) {
      setError(err.message);
    } finally {
      setAiBusy(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const duration = Number(form.duration_days);
    const co2 = Number(form.co2_per_checkin);
    const goal = Number(form.goal_checkins);
    if (form.title.trim().length < 3) return setError('Give your challenge a title (at least 3 characters).');
    if (!Number.isInteger(duration) || duration < 1 || duration > 365) return setError('Duration must be a whole number between 1 and 365 days.');
    if (!Number.isFinite(co2) || co2 < 0 || co2 > 100) return setError('CO₂ saved per check-in must be between 0 and 100 kg.');
    if (!Number.isInteger(goal) || goal < 1 || goal > 100000) return setError('Community goal must be a whole number of check-ins (1 or more).');

    setSaving(true);
    try {
      const body = { title: form.title.trim(), description: form.description.trim(), category: form.category, duration_days: duration, co2_per_checkin: co2, goal_checkins: goal };
      if (challenge) await api(`/challenges/${challenge.id}`, { method: 'PUT', body });
      else await api('/challenges', { method: 'POST', body });
      toast(challenge ? 'Challenge updated' : 'Challenge created. You are in!');
      await onSaved?.();
      onClose();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {!challenge && (
        <div className="rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 p-3.5">
          <p className="flex items-center gap-1.5 text-sm font-bold text-emerald-800">
            <Sparkles size={15} /> Need an idea? Let AI draft it
          </p>
          <div className="mt-2 flex gap-2">
            <input className="input !py-2" placeholder="Theme, e.g. cycling to campus" maxLength={200} value={theme} onChange={(e) => setTheme(e.target.value)} aria-label="Challenge theme" />
            <Button variant="primary" size="sm" className="!h-[42px] shrink-0" onClick={generate} loading={aiBusy}>
              {!aiBusy && <Sparkles size={15} />} Generate
            </Button>
          </div>
        </div>
      )}

      <Field label="Title">
        {(id) => <input id={id} className="input" maxLength={80} placeholder="e.g. Bring-your-own-bottle week" value={form.title} onChange={set('title')} />}
      </Field>
      <Field label="Description">
        {(id) => <textarea id={id} className="input min-h-[80px] resize-y" maxLength={400} placeholder="What does a daily check-in mean?" value={form.description} onChange={set('description')} />}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Category">
          {(id) => (
            <select id={id} className="input" value={form.category} onChange={set('category')}>
              {Object.entries(cats).map(([k, c]) => (
                <option key={k} value={k}>
                  {c.emoji} {c.label}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Duration (days)">
          {(id) => <input id={id} className="input" type="number" inputMode="numeric" min="1" max="365" step="1" value={form.duration_days} onChange={set('duration_days')} />}
        </Field>
        <Field label="CO₂e saved / check-in (kg)">
          {(id) => <input id={id} className="input" type="number" inputMode="decimal" min="0" max="100" step="any" value={form.co2_per_checkin} onChange={set('co2_per_checkin')} />}
        </Field>
        <Field label="Community goal (check-ins)">
          {(id) => <input id={id} className="input" type="number" inputMode="numeric" min="1" step="1" value={form.goal_checkins} onChange={set('goal_checkins')} />}
        </Field>
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
          {challenge ? 'Save changes' : 'Create challenge'}
        </Button>
      </div>
    </form>
  );
}

function Leaderboard() {
  const { data, loading, error, retry } = useFetch('/challenges/leaderboard');
  if (loading && !data) return <Card><div className="space-y-3">{[0, 1, 2, 3].map((i) => <div key={i} className="h-12 animate-pulse rounded-2xl bg-slate-100" />)}</div></Card>;
  if (error && !data) return <ErrorState message={error} onRetry={retry} />;
  const rows = [...data.top];
  if (data.me && !rows.some((r) => r.isMe)) rows.push(data.me);
  const medal = ['text-amber-500', 'text-slate-400', 'text-orange-400'];

  return (
    <Card>
      <h2 className="section-title">Community leaderboard</h2>
      <p className="mb-3 text-sm text-slate-500">Eco-points from logging, low-carbon choices and challenge check-ins · {data.total} member{data.total === 1 ? '' : 's'}</p>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={`${r.rank}-${r.name}`} className={cx('flex items-center gap-3 rounded-2xl px-3 py-2.5', r.isMe ? 'bg-emerald-50 ring-1 ring-emerald-200' : 'bg-slate-50/70')}>
            <span className="flex w-8 shrink-0 justify-center">
              {r.rank <= 3 ? <Medal size={22} className={medal[r.rank - 1]} /> : <span className="text-sm font-bold text-slate-400">{r.rank}</span>}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold text-slate-800">
                {r.name} {r.isMe && <span className="ml-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white">You</span>}
              </p>
              <p className="text-xs text-slate-500">{r.levelName}</p>
            </div>
            <div className="text-right">
              <p className="font-extrabold text-emerald-600">{fmt(r.points, 0)}</p>
              <p className="text-[11px] font-semibold text-slate-400">points</p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default function Challenges() {
  const { meta } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload, retry } = useFetch(`/challenges?today=${todayStr()}`);
  const [tab, setTab] = useState('all');
  const [busy, setBusy] = useState(null);
  const [formFor, setFormFor] = useState(null); // 'new' | challenge
  const [deleting, setDeleting] = useState(null);
  const [leaving, setLeaving] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const cats = meta?.challengeCategories || FALLBACK_CATS;

  const act = async (c, fn, successMsg) => {
    setBusy(c.id);
    try {
      await fn();
      if (successMsg) toast(successMsg);
      await reload();
    } catch (e) {
      toast(e.message, 'error');
      await reload();
    } finally {
      setBusy(null);
    }
  };

  const join = (c) => act(c, () => api(`/challenges/${c.id}/join`, { method: 'POST' }), `You joined "${c.title}"`);
  const checkin = (c) => act(c, () => api(`/challenges/${c.id}/checkin`, { method: 'POST', body: { today: todayStr() } }), `Checked in! +20 points · ${fmt(c.co2_per_checkin)} kg CO₂e saved`);

  const confirm = async (fn, done, msg) => {
    setConfirmBusy(true);
    try {
      await fn();
      toast(msg);
      done();
      await reload();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setConfirmBusy(false);
    }
  };

  const header = (
    <PageHeader
      title="Eco-Action Challenges"
      subtitle="Join your community, check in daily and track the collective impact."
      action={
        <Button onClick={() => setFormFor('new')}>
          <Plus size={18} /> New challenge
        </Button>
      }
    />
  );

  if (loading && !data) return <>{header}<PageLoader cards={3} /></>;
  if (error && !data) return <>{header}<ErrorState message={error} onRetry={retry} /></>;

  const all = data.challenges;
  const joined = all.filter((c) => c.joined);
  const shown = tab === 'joined' ? joined : all;
  const community = data.community;

  return (
    <>
      {header}

      <div className="grid grid-cols-3 gap-3 lg:gap-4">
        {[
          { icon: Leaf, tint: 'bg-emerald-50 text-emerald-600', value: fmt(community.co2_saved), unit: 'kg', label: 'CO₂e saved together' },
          { icon: Users, tint: 'bg-sky-50 text-sky-600', value: fmt(community.participants, 0), label: 'Active members' },
          { icon: CheckCircle2, tint: 'bg-amber-50 text-amber-600', value: fmt(community.checkins, 0), label: 'Total check-ins' },
        ].map((x) => (
          <Card key={x.label} className="!p-3.5 sm:!p-5">
            <span className={cx('flex h-9 w-9 items-center justify-center rounded-xl', x.tint)}>
              <x.icon size={18} />
            </span>
            <p className="mt-2.5 text-xl font-extrabold leading-none text-slate-900 sm:text-3xl">
              {x.value}
              {x.unit && <span className="ml-1 text-xs font-semibold text-slate-400 sm:text-sm">{x.unit}</span>}
            </p>
            <p className="mt-1.5 text-[11px] font-semibold leading-tight text-slate-500 sm:text-sm">{x.label}</p>
          </Card>
        ))}
      </div>

      <div className="no-scrollbar -mx-4 my-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {[
          ['all', `All challenges (${all.length})`],
          ['joined', `Joined (${joined.length})`],
          ['leaderboard', 'Leaderboard'],
        ].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={cx('chip', tab === k ? 'chip-on' : 'chip-off')}>
            {k === 'leaderboard' && <Trophy size={15} />} {label}
          </button>
        ))}
      </div>

      {tab === 'leaderboard' ? (
        <Leaderboard />
      ) : !shown.length ? (
        <Card>
          <EmptyState
            icon={Users}
            title={tab === 'joined' ? 'You have not joined a challenge yet' : 'No challenges yet'}
            text={tab === 'joined' ? 'Pick one from the list and start checking in.' : 'Create the first one for your community.'}
            action={
              tab === 'joined' ? (
                <Button size="sm" variant="soft" onClick={() => setTab('all')}>
                  Browse challenges
                </Button>
              ) : (
                <Button size="sm" onClick={() => setFormFor('new')}>
                  <Plus size={16} /> New challenge
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {shown.map((c) => {
            const cat = cats[c.category] || cats.general || FALLBACK_CATS.general;
            const isBusy = busy === c.id;
            return (
              <Card key={c.id} className="flex flex-col">
                <div className="flex items-start gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-100 text-2xl" aria-hidden="true">
                    {cat.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">{cat.label}</span>
                      {c.is_official && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">Official</span>}
                      {c.is_owner && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-sky-700">Created by you</span>}
                    </div>
                    <h3 className="mt-1 text-lg font-extrabold leading-snug text-slate-900">{c.title}</h3>
                  </div>
                  {c.is_owner && (
                    <div className="-mr-2 -mt-1 flex shrink-0">
                      <IconButton label="Edit challenge" onClick={() => setFormFor(c)}>
                        <Pencil size={16} />
                      </IconButton>
                      <IconButton label="Delete challenge" onClick={() => setDeleting(c)} className="hover:bg-rose-50 hover:text-rose-600">
                        <Trash2 size={16} />
                      </IconButton>
                    </div>
                  )}
                </div>

                {c.description && <p className="mt-3 text-sm leading-relaxed text-slate-600">{c.description}</p>}

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <Users size={14} /> {c.members} {c.members === 1 ? 'member' : 'members'}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <CalendarClock size={14} /> {c.duration_days} days
                  </span>
                  <span className="inline-flex items-center gap-1 text-emerald-600">
                    <Leaf size={14} /> {fmt(c.co2_saved)} kg CO₂e saved
                  </span>
                </div>

                <div className="mt-4">
                  <div className="mb-1.5 flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-500">Collective progress</span>
                    <span className="text-slate-700">
                      {fmt(c.total_checkins, 0)} / {fmt(c.goal_checkins, 0)} check-ins
                    </span>
                  </div>
                  <ProgressBar value={c.progress_pct} color="bg-gradient-to-r from-emerald-400 to-teal-500" />
                </div>

                <div className="mt-4 flex flex-1 items-end">
                  {c.joined ? (
                    <div className="flex w-full items-center gap-2">
                      <Button className="flex-1" variant={c.checked_in_today ? 'soft' : 'primary'} size="sm" disabled={c.checked_in_today} loading={isBusy} onClick={() => checkin(c)}>
                        {!isBusy && <Check size={16} />}
                        {c.checked_in_today ? 'Checked in today' : 'Check in today'}
                      </Button>
                      <span className="shrink-0 rounded-xl bg-slate-100 px-2.5 py-2 text-xs font-bold text-slate-600">
                        {c.my_checkins} {c.my_checkins === 1 ? 'day' : 'days'}
                      </span>
                      <IconButton label="Leave challenge" onClick={() => setLeaving(c)} className="hover:bg-rose-50 hover:text-rose-600">
                        <LogOut size={16} />
                      </IconButton>
                    </div>
                  ) : (
                    <Button className="w-full" variant="secondary" size="sm" loading={isBusy} onClick={() => join(c)}>
                      {!isBusy && <Plus size={16} />} Join challenge
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <ChallengeModal open={Boolean(formFor)} challenge={formFor && formFor !== 'new' ? formFor : null} cats={cats} onClose={() => setFormFor(null)} onSaved={reload} />
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete this challenge?"
        message={deleting ? `"${deleting.title}" and all of its check-ins will be removed for every member.` : ''}
        loading={confirmBusy}
        onClose={() => setDeleting(null)}
        onConfirm={() => confirm(() => api(`/challenges/${deleting.id}`, { method: 'DELETE' }), () => setDeleting(null), 'Challenge deleted')}
      />
      <ConfirmDialog
        open={Boolean(leaving)}
        title="Leave this challenge?"
        message={leaving ? `Your ${leaving.my_checkins} check-in${leaving.my_checkins === 1 ? '' : 's'} for "${leaving.title}" will be removed.` : ''}
        confirmLabel="Leave"
        loading={confirmBusy}
        onClose={() => setLeaving(null)}
        onConfirm={() => confirm(() => api(`/challenges/${leaving.id}/join`, { method: 'DELETE' }), () => setLeaving(null), 'You left the challenge')}
      />
    </>
  );
}
