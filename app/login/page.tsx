
import React, { useState } from 'react';
import { ArrowRight, Eye, EyeOff, Loader2, Lock, ShieldAlert, ShieldCheck, UserRound } from 'lucide-react';
import { clientConfig } from '../../config/clientConfig';

interface LoginPageProps {
  onLogin: (identifier: string, password: string) => Promise<void>;
}

const getLoginErrorMessage = (message?: string) => {
  const normalized = (message || '').toLowerCase();

  if (normalized.includes('invalid login credentials')) {
    return 'The username or password was not accepted. Try the full email, or use the assigned login code.';
  }

  if (normalized.includes('not linked') || normalized.includes('branch profile')) {
    return 'This Auth user exists, but it is not linked to an active app profile. Add or activate the matching app_user_profiles row.';
  }

  return message || 'Unable to sign in. Check the username, password, and account setup.';
};

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const identifier = code.trim();
    if (!identifier || !password) return;

    setIsLoading(true);
    setError('');

    try {
      await onLogin(identifier, password);
    } catch (err: any) {
      setError(getLoginErrorMessage(err?.message));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 font-sans selection:bg-brand/10 md:px-8 md:py-10">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-6xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.10)] md:min-h-[calc(100vh-5rem)]">
        <section className="relative hidden w-[48%] overflow-hidden bg-slate-950 text-white lg:flex">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,#111827_0%,#020617_62%,#3f0d12_100%)]" />
          <div className="absolute inset-y-0 right-0 w-1 bg-brand" />
          <div className="absolute inset-0 opacity-[0.055]">
            <svg width="100%" height="100%" aria-hidden="true">
              <defs>
                <pattern id="login-grid" width="42" height="42" patternUnits="userSpaceOnUse">
                  <path d="M 42 0 L 0 0 0 42" fill="none" stroke="white" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#login-grid)" />
            </svg>
          </div>

          <div className="relative z-10 flex h-full w-full flex-col justify-between p-10 xl:p-12">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-white shadow-sm">
                <img src={clientConfig.logoUrl} alt="Tabarak HUB logo" className="h-full w-full object-cover" />
              </div>
              <div>
                <p className="text-2xl font-black tracking-tight text-white">Tabarak HUB</p>
                <p className="mt-1 text-xs font-black uppercase tracking-[0.22em] text-red-200/75">Operational Platform</p>
              </div>
            </div>

            <div className="max-w-md">
              <div className="mb-6 h-1 w-16 rounded-full bg-brand" />
              <h1 className="text-5xl font-black leading-[0.98] tracking-tight text-white xl:text-6xl">
                Controlled access for daily operations.
              </h1>
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-white/10 pt-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/35">Mode</p>
                <p className="mt-2 text-sm font-bold text-white">Dedicated client</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/35">Access</p>
                <p className="mt-2 text-sm font-bold text-white">Role based</p>
              </div>
            </div>
          </div>
        </section>

        <section className="flex flex-1 items-center justify-center px-5 py-8 sm:px-8 lg:px-12">
          <div className="w-full max-w-[420px]">
            <div className="mb-9 flex items-center gap-4 lg:hidden">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <img src={clientConfig.logoUrl} alt="Tabarak HUB logo" className="h-full w-full object-cover" />
              </div>
              <div>
                <p className="text-lg font-black tracking-tight text-slate-950">Tabarak HUB</p>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand">Operational Platform</p>
              </div>
            </div>

            <div className="mb-8">
              <h2 className="text-3xl font-black tracking-tight text-slate-950">Log in</h2>
              <div className="mt-3 h-1 w-14 rounded-full bg-brand" />
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="login-identifier" className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                  <UserRound className="h-3.5 w-3.5 text-brand" />
                  <span>Email or login code</span>
                </label>
                <div className="group relative rounded-lg border border-slate-200 bg-white transition-colors focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10">
                  <input
                    id="login-identifier"
                    type="text"
                    autoComplete="username"
                    className="h-[52px] w-full rounded-lg bg-transparent px-4 py-4 text-sm font-bold text-slate-950 outline-none placeholder:text-slate-300"
                    placeholder="Enter email or code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="login-password" className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
                  <Lock className="h-3.5 w-3.5 text-brand" />
                  <span>Password</span>
                </label>
                <div className="group relative rounded-lg border border-slate-200 bg-white pr-12 transition-colors focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    className="h-[52px] w-full rounded-lg bg-transparent px-4 py-4 text-sm font-bold text-slate-950 outline-none placeholder:text-slate-300"
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(current => !current)}
                    className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-3 rounded-lg border border-red-100 bg-red-50 p-4 text-sm font-semibold leading-relaxed text-brand">
                  <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="flex w-full items-center justify-center gap-3 rounded-lg bg-brand px-5 py-4 text-sm font-black uppercase tracking-[0.14em] text-white shadow-lg shadow-brand/20 transition-all hover:bg-brand-hover hover:shadow-xl hover:shadow-brand/25 active:scale-[0.99] disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <span>Log in</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 flex flex-col gap-3 border-t border-slate-100 pt-6 text-slate-400 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span className="text-[10px] font-black uppercase tracking-[0.16em]">Secure connection</span>
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.16em]">Developed by Ahmed Elsherbini</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
