import { Navigate, Route, Routes } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from './context/AuthContext.jsx';
import Layout, { Backdrop } from './components/Layout.jsx';
import { Logo } from './components/ui.jsx';
import AuthPage from './pages/Auth.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Tracker from './pages/Tracker.jsx';
import Resources from './pages/Resources.jsx';
import Challenges from './pages/Challenges.jsx';
import Insights from './pages/Insights.jsx';
import Profile from './pages/Profile.jsx';

function Splash() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-5">
      <Backdrop />
      <Logo size={52} />
      <Loader2 className="animate-spin text-emerald-500" size={26} />
    </div>
  );
}

export default function App() {
  const { user, ready } = useAuth();
  if (!ready) return <Splash />;

  return (
    <Routes>
      <Route path="/auth" element={user ? <Navigate to="/" replace /> : <AuthPage />} />
      <Route element={user ? <Layout /> : <Navigate to="/auth" replace />}>
        <Route index element={<Dashboard />} />
        <Route path="tracker" element={<Tracker />} />
        <Route path="resources" element={<Resources />} />
        <Route path="challenges" element={<Challenges />} />
        <Route path="insights" element={<Insights />} />
        <Route path="profile" element={<Profile />} />
      </Route>
      <Route path="*" element={<Navigate to={user ? '/' : '/auth'} replace />} />
    </Routes>
  );
}
