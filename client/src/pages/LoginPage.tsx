import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { extractMessage } from '../utils/errorMessages';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Role } from '../types';

export function LoginPage() {
  const { login, user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  // Redirect if already authenticated
  if (user) {
    navigate(user.role === Role.APPROVER ? '/admin' : '/dashboard', { replace: true });
    return null;
  }

  function validate(): boolean {
    const next: { email?: string; password?: string } = {};
    if (!email.trim()) next.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = 'Enter a valid email address.';
    if (!password) next.password = 'Password is required.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    try {
      await login(email.trim(), password);
      // AuthContext will have updated — read role from the response
      // We navigate after a tick to let state propagate
      showToast('Welcome back!', 'success');
      // The navigate happens via the re-render once `user` is set
    } catch (err) {
      showToast(extractMessage(err), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-200 mb-4">
            <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Access Manager</h1>
          <p className="mt-1 text-sm text-gray-500">Sign in to your account</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl bg-white shadow-sm border border-gray-100 px-8 py-8">
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <Input
              label="Email address"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
              }}
              error={errors.email}
              disabled={isLoading}
            />
            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors((p) => ({ ...p, password: undefined }));
              }}
              error={errors.password}
              disabled={isLoading}
            />
            <Button
              type="submit"
              size="lg"
              isLoading={isLoading}
              className="w-full mt-1"
            >
              Sign in
            </Button>
          </form>

          {/* Demo credentials helper */}
          <div className="mt-6 rounded-lg bg-gray-50 border border-gray-100 px-4 py-3">
            <p className="text-xs font-medium text-gray-500 mb-2">Demo accounts (password: <code className="font-mono">Password123!</code>)</p>
            <div className="grid grid-cols-2 gap-1 text-xs text-gray-500">
              <button
                type="button"
                onClick={() => { setEmail('alice@company.com'); setPassword('Password123!'); }}
                className="text-left hover:text-indigo-600 transition-colors truncate"
              >
                alice@company.com <span className="text-gray-400">(Employee)</span>
              </button>
              <button
                type="button"
                onClick={() => { setEmail('bob@company.com'); setPassword('Password123!'); }}
                className="text-left hover:text-indigo-600 transition-colors truncate"
              >
                bob@company.com <span className="text-gray-400">(Employee)</span>
              </button>
              <button
                type="button"
                onClick={() => { setEmail('carol@company.com'); setPassword('Password123!'); }}
                className="text-left hover:text-indigo-600 transition-colors truncate"
              >
                carol@company.com <span className="text-gray-400">(Approver)</span>
              </button>
              <button
                type="button"
                onClick={() => { setEmail('dave@company.com'); setPassword('Password123!'); }}
                className="text-left hover:text-indigo-600 transition-colors truncate"
              >
                dave@company.com <span className="text-gray-400">(Approver)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
