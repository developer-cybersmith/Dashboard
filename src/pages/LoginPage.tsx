import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { Lock, LogIn, Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="bg-fx" aria-hidden>
        <div className="aurora aurora-1" />
        <div className="aurora aurora-2" />
        <div className="aurora aurora-3" />
        <div className="grid-overlay" />
      </div>

      <div className="login-card">
        <div className="login-brand">
          <div className="brand-icon">CSS</div>
          <div>
            <h1>CyberSmithSecure</h1>
            <p>Secure Dashboard Access</p>
          </div>
        </div>

        <div className="login-authvr5-badge">
          <ShieldCheck size={16} />
          <span>Authorized users only</span>
        </div>

        <p className="login-subtitle">
          Sign in with your authorized email and the shared dashboard password.
        </p>

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="login-field">
            <span>Work Email</span>
            <div className="login-input-wrap">
              <Mail size={18} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@cybersmithsecure.com"
                autoComplete="email"
                required
              />
            </div>
          </label>

          <label className="login-field">
            <span>Password</span>
            <div className="login-input-wrap">
              <Lock size={18} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                autoComplete="current-password"
                required
              />
            </div>
          </label>

          {error && <p className="login-error">{error}</p>}

          <button type="submit" className="btn btn-blue login-submit" disabled={submitting}>
            <LogIn size={18} />
            {submitting ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="login-footer">
          Only 4 authorized @cybersmithsecure.com accounts can access this dashboard.
        </p>
      </div>
    </div>
  );
}
