import { useEffect, useRef, useState } from 'react';
import { Sparkles, Send, RefreshCw, Loader2, Bot, Info } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { cx, fmt, initials, todayStr, useFetch } from '../lib/utils.js';
import { Button, Card, PageHeader } from '../components/ui.jsx';
import Markdown from '../components/Markdown.jsx';

const QUICK = [
  'How can I cut my commute emissions?',
  'Give me a 7-day low-carbon plan',
  'Where am I wasting the most energy?',
  'Suggest sustainable swaps for my habits',
];

const readSaved = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
};

export default function Insights() {
  const { user } = useAuth();
  const toast = useToast();
  const storageKey = `gt_insights_${user.id}`;
  const stats = useFetch(`/stats?today=${todayStr()}`);
  const [insights, setInsights] = useState(() => readSaved(storageKey));
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    if (messages.length) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, asking]);

  const generate = async () => {
    setLoadingInsights(true);
    try {
      const d = await api('/ai/generate', { method: 'POST', body: { mode: 'insights', today: todayStr() } });
      const saved = { text: d.text, source: d.source, at: new Date().toISOString() };
      setInsights(saved);
      try {
        localStorage.setItem(storageKey, JSON.stringify(saved));
      } catch {
        /* ignore */
      }
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoadingInsights(false);
    }
  };

  const ask = async (text) => {
    const q = (text ?? question).trim();
    if (!q || asking) return;
    setQuestion('');
    setMessages((m) => [...m, { role: 'user', text: q }]);
    setAsking(true);
    try {
      const d = await api('/ai/generate', { method: 'POST', body: { mode: 'assist', prompt: q, today: todayStr() } });
      setMessages((m) => [...m, { role: 'ai', text: d.text }]);
    } catch (e) {
      setMessages((m) => [...m, { role: 'ai', text: e.message, error: true }]);
    } finally {
      setAsking(false);
    }
  };

  const s = stats.data;
  const top = s?.byCategory?.[0];

  return (
    <>
      <PageHeader title="AI Insights" subtitle="Personalised, data-driven recommendations from your eco-coach, powered by Google Gemini." />

      {/* Snapshot the AI works from */}
      <div className="grid grid-cols-3 gap-3 lg:gap-4">
        {[
          { label: 'This month', value: s ? `${fmt(s.month.kg)} kg` : '—' },
          { label: 'Budget used', value: s ? `${fmt(s.month.pct, 0)}%` : '—' },
          { label: 'Biggest source', value: s ? top?.label || 'No data' : '—' },
        ].map((x) => (
          <Card key={x.label} className="!p-3.5 sm:!p-5">
            <p className="text-[11px] font-semibold text-slate-500 sm:text-sm">{x.label}</p>
            <p className="mt-1 truncate text-lg font-extrabold text-slate-900 sm:text-2xl">{x.value}</p>
          </Card>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Insights */}
        <Card className="relative overflow-hidden">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-100/70 blur-3xl" />
          <div className="relative">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-glow">
                  <Sparkles size={20} />
                </span>
                <div>
                  <h2 className="section-title">Your personalised insights</h2>
                  <p className="text-sm text-slate-500">Based on everything you have logged</p>
                </div>
              </div>
              {insights && (
                <Button variant="ghost" size="sm" onClick={generate} loading={loadingInsights} className="shrink-0">
                  {!loadingInsights && <RefreshCw size={15} />} <span className="hidden sm:inline">Refresh</span>
                </Button>
              )}
            </div>

            <div className="mt-4">
              {loadingInsights && !insights ? (
                <div className="flex flex-col items-center gap-3 py-10 text-slate-500">
                  <Loader2 className="animate-spin text-emerald-500" size={26} />
                  <p className="text-sm">Analysing your footprint…</p>
                </div>
              ) : insights ? (
                <div className={cx('transition-opacity', loadingInsights && 'opacity-50')}>
                  {insights.source === 'fallback' && (
                    <p className="mb-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
                      <Info size={14} className="mt-0.5 shrink-0" /> The AI coach is unavailable right now, so these are built-in smart tips from your data. Try refreshing in a moment.
                    </p>
                  )}
                  <Markdown text={insights.text} />
                  <p className="mt-4 text-xs text-slate-400">
                    Generated {new Date(insights.at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })} · Estimates only
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <p className="max-w-xs text-sm text-slate-500">Get a clear summary of where you stand and the three actions that will cut the most carbon.</p>
                  <Button onClick={generate}>
                    <Sparkles size={18} /> Generate my insights
                  </Button>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Ask the coach */}
        <Card className="flex flex-col">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
              <Bot size={22} />
            </span>
            <div>
              <h2 className="section-title">Ask your eco-coach</h2>
              <p className="text-sm text-slate-500">Questions about saving energy, water, waste or money</p>
            </div>
          </div>

          <div className="mt-4 flex-1 space-y-3">
            {!messages.length && (
              <div className="flex flex-wrap gap-2">
                {QUICK.map((q) => (
                  <button key={q} onClick={() => ask(q)} disabled={asking} className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-left text-sm font-medium text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700 disabled:opacity-60">
                    {q}
                  </button>
                ))}
              </div>
            )}
            {messages.map((m, i) =>
              m.role === 'user' ? (
                <div key={i} className="flex justify-end gap-2">
                  <p className="max-w-[85%] rounded-2xl rounded-br-md bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 text-[15px] text-white">{m.text}</p>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[11px] font-bold text-slate-600">{initials(user.full_name)}</span>
                </div>
              ) : (
                <div key={i} className="flex gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                    <Sparkles size={15} />
                  </span>
                  <div className={cx('max-w-[88%] rounded-2xl rounded-bl-md px-4 py-3', m.error ? 'bg-rose-50 text-sm font-medium text-rose-600' : 'bg-slate-50')}>
                    {m.error ? m.text : <Markdown text={m.text} />}
                  </div>
                </div>
              )
            )}
            {asking && (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <Loader2 size={15} className="animate-spin" />
                </span>
                Thinking…
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              ask();
            }}
          >
            <input className="input !rounded-2xl" placeholder="Ask anything about living greener…" maxLength={1000} value={question} onChange={(e) => setQuestion(e.target.value)} aria-label="Your question" />
            <Button type="submit" className="!w-11 shrink-0 !px-0" disabled={!question.trim() || asking} aria-label="Send">
              <Send size={18} />
            </Button>
          </form>
        </Card>
      </div>
    </>
  );
}
