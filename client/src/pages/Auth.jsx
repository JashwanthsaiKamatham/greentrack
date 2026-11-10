import { useEffect, useState } from 'react';
import { Eye, EyeOff, BarChart3, Gauge, Users, Sparkles, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { cx } from '../lib/utils.js';
import { Backdrop } from '../components/Layout.jsx';
import { Button, Field, Logo } from '../components/ui.jsx';

const FEATURES = [
  { icon: BarChart3, title: 'Carbon dashboard', text: 'See your daily and monthly footprint from commute, energy, food and more.' },
  { icon: Gauge, title: 'Smart resource logger', text: 'Track electricity, water and waste against your own monthly targets.' },
  { icon: Users, title: 'Community challenges', text: 'Join zero-plastic weeks and energy-saving days. Watch the collective impact grow.' },
  { icon: Sparkles, title: 'AI eco-coach', text: 'Personalised, data-driven tips to cut waste and switch to greener options.' },
];

export default function AuthPage() {
  const { signIn } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ full_name: '', email: '', password: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState('');
  const isSignup = mode === 'signup';

  // The free backend sleeps when idle; reassure the user while it wakes up.
  useEffect(() => {
    if (!loading) {
      setSlow(false);
      return undefined;
    }
    const t = setTimeout(() => setSlow(true), 5000);
    return () => clearTimeout(t);
  }, [loading]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const switchMode = (m) => {
    setMode(m);
    setError('');
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const email = form.email.trim();
    if (isSignup && !form.full_name.trim()) return setError('Please enter your name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return setError('Please enter a valid email address.');
    if (isSignup && form.password.length < 8) return setError('Password must be at least 8 characters.');
    if (!form.password) return setError('Please enter your password.');

    setLoading(true);
    try {
      const data = await api(isSignup ? '/auth/signup' : '/auth/login', {
        method: 'POST',
        body: isSignup ? { full_name: form.full_name.trim(), email, password: form.password } : { email, password: form.password },
      });
      signIn(data.token, data.user);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center px-4 py-8 sm:px-6">
      <Backdrop />
      <div className="grid w-full max-w-5xl items-center gap-8 lg:grid-cols-2 lg:gap-14">
        {/* Left: pitch */}
        <div className="hidden lg:block">
          <Logo size={46} />
          <h1 className="mt-8 text-[42px] font-extrabold leading-[1.1] text-slate-900">
            Measure less carbon.
            <br />
            <span className="text-gradient">Live more sustainably.</span>
          </h1>
          <p className="mt-4 max-w-md text-lg text-slate-600">
            One simple place for your community, campus or small business to track, understand and shrink its environmental impact.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="glass rounded-3xl p-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                  <f.icon size={20} />
                </span>
                <p className="mt-3 font-bold text-slate-800">{f.title}</p>
                <p className="mt-1 text-sm leading-snug text-slate-500">{f.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right: form */}
        <div className="mx-auto w-full max-w-md">
          <div className="mb-6 flex flex-col items-center text-center lg:hidden">
            <Logo size={48} />
            <p className="mt-3 text-[15px] text-slate-600">Track your carbon footprint, save resources and join green challenges.</p>
          </div>

          <div className="glass animate-fade-up rounded-[32px] p-6 sm:p-8">
            <div className="grid grid-cols-2 rounded-2xl bg-slate-100/80 p-1" role="tablist">
              {[
                ['login', 'Log in'],
                ['signup', 'Sign up'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={mode === key}
                  onClick={() => switchMode(key)}
                  className={cx('rounded-xl py-2.5 text-sm font-bold transition', mode === key ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700')}
                >
                  {label}
                </button>
              ))}
            </div>

            <h2 className="mt-6 text-2xl font-extrabold text-slate-900">{isSignup ? 'Create your account' : 'Welcome back'}</h2>
            <p className="mt-1 text-sm text-slate-500">{isSignup ? 'Start tracking your impact in under a minute.' : 'Log in to continue your green journey.'}</p>

            <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
              {isSignup && (
                <Field label="Full name">
                  {(id) => <input id={id} className="input" autoComplete="name" placeholder="Asha Kumar" maxLength={80} value={form.full_name} onChange={set('full_name')} />}
                </Field>
              )}
              <Field label="Email">
                {(id) => (
                  <input id={id} className="input" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" placeholder="you@example.com" value={form.email} onChange={set('email')} />
                )}
              </Field>
              <Field label="Password" hint={isSignup ? 'At least 8 characters.' : undefined}>
                {(id) => (
                  <div className="relative">
                    <input
                      id={id}
                      className="input pr-11"
                      type={showPw ? 'text' : 'password'}
                      autoComplete={isSignup ? 'new-password' : 'current-password'}
                      placeholder="••••••••"
                      maxLength={72}
                      value={form.password}
                      onChange={set('password')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((s) => !s)}
                      aria-label={showPw ? 'Hide password' : 'Show password'}
                      className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:text-slate-600"
                    >
                      {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                )}
              </Field>

              {error && (
                <p role="alert" className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm font-medium text-rose-600">
                  {error}
                </p>
              )}

              <Button type="submit" size="lg" loading={loading} className="w-full">
                {loading ? (slow ? 'Waking up the server…' : 'Please wait…') : isSignup ? 'Create account' : 'Log in'}
              </Button>
              {slow && <p className="text-center text-xs text-slate-500">The first request after a quiet period can take up to a minute.</p>}
            </form>

            <p className="mt-5 text-center text-sm text-slate-500">
              {isSignup ? 'Already have an account?' : 'New to GreenTrack?'}{' '}
              <button type="button" onClick={() => switchMode(isSignup ? 'login' : 'signup')} className="font-bold text-emerald-600 hover:text-emerald-700">
                {isSignup ? 'Log in' : 'Create one'}
              </button>
            </p>
          </div>

          <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-slate-400">
            <ShieldCheck size={14} /> Passwords are encrypted with bcrypt. Your data stays private to you.
          </p>
        </div>
      </div>
    </div>
  );
}
