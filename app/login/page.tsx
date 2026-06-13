
import React, { useState } from 'react';
import { ChevronRight, ShieldCheck, ShieldAlert, Loader2, Lock, Building2 } from 'lucide-react';
import { clientConfig } from '../../config/clientConfig';

interface LoginPageProps {
  onLogin: (identifier: string, password: string) => Promise<void>;
}

const getLoginErrorMessage = (message?: string) => {
  const normalized = (message || '').toLowerCase();

  if (normalized.includes('invalid login credentials')) {
    return 'The username or password was not accepted. Try the full email, or use the short code only if that Auth user exists.';
  }

  if (normalized.includes('not linked') || normalized.includes('branch profile')) {
    return 'This Auth user exists, but it is not linked to an active app profile. Add or activate the matching app_user_profiles row.';
  }

  return message || 'Unable to sign in. Check the username, password, and Supabase Auth setup.';
};

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

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
    <div className="min-h-screen flex flex-col md:flex-row bg-white font-sans selection:bg-brand/10">
      {/* Left Panel - Brand / Hero */}
      <div className="hidden md:flex md:w-[55%] bg-slate-950 items-center justify-center p-16 relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 w-full h-full opacity-[0.015] pointer-events-none">
            <svg width="100%" height="100%"><defs><pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M 50 0 L 0 0 0 50" fill="none" stroke="white" strokeWidth="1" /></pattern></defs><rect width="100%" height="100%" fill="url(#grid)" /></svg>
          </div>
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-brand/10 rounded-full blur-[120px]"></div>
          <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] bg-brand/5 rounded-full blur-[100px]"></div>
        </div>

        <div className="relative z-10 flex max-w-xl flex-col items-center text-center">
          <div className="mb-10 flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-brand shadow-2xl shadow-brand/30 ring-2 ring-white/10">
            <img src={clientConfig.logoUrl} alt="Tabarak HUB logo" className="w-full h-full object-cover" />
          </div>

          <h1 className="mb-5 text-center text-6xl font-black leading-[1.05] tracking-tighter text-brand">
            Tabarak HUB
          </h1>

          <p className="mx-auto mb-10 max-w-md text-center text-lg font-medium leading-relaxed text-slate-400">
            Operational Platform
          </p>

          <div className="flex flex-col items-center space-y-4">
            <div className="flex w-fit items-center space-x-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-5 py-3">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">End-to-End Encryption Active</span>
            </div>
            <div className="flex w-fit items-center space-x-3 rounded-xl border border-white/10 bg-white/5 px-5 py-3">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">All Systems Operational</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 md:p-16 relative">
        {/* Subtle background */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50/50 to-white pointer-events-none"></div>

        <div className="w-full max-w-[420px] relative z-10">
          {/* Mobile Logo */}
          <div className="mb-10 flex flex-col items-center justify-center text-center md:hidden">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-brand shadow-xl shadow-brand/20">
              <img src={clientConfig.logoUrl} alt="Tabarak HUB logo" className="w-full h-full object-cover" />
            </div>
            <h1 className="mt-5 text-3xl font-black tracking-tight text-brand">Tabarak HUB</h1>
            <p className="mt-1 text-xs font-black uppercase tracking-[0.2em] text-slate-400">Operational Platform</p>
          </div>

          <div className="mb-10">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Log in</h2>
            <div className="mt-3 h-1 w-14 rounded-full bg-brand"></div>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1 flex items-center space-x-2">
                <Building2 className="w-3.5 h-3.5" />
                <span>Email or Login Code</span>
              </label>
              <div className={`relative rounded-xl border-2 transition-all duration-300 ${focusedField === 'code' ? 'border-brand shadow-lg shadow-brand/5' : 'border-slate-100 hover:border-slate-200'}`}>
                <input
                  type="text"
                  autoComplete="username"
                  className="w-full px-5 py-4 rounded-xl bg-transparent text-slate-900 font-bold outline-none text-base placeholder:text-slate-300"
                  placeholder="admin or t01@tabarak.local"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onFocus={() => setFocusedField('code')}
                  onBlur={() => setFocusedField(null)}
                  required
                />
              </div>
              <p className="ml-1 text-xs font-medium text-slate-400">.</p>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1 flex items-center space-x-2">
                <Lock className="w-3.5 h-3.5" />
                <span>Password</span>
              </label>
              <div className={`relative rounded-xl border-2 transition-all duration-300 ${focusedField === 'password' ? 'border-brand shadow-lg shadow-brand/5' : 'border-slate-100 hover:border-slate-200'}`}>
                <input
                  type="password"
                  autoComplete="current-password"
                  className="w-full px-5 py-4 rounded-xl bg-transparent text-slate-900 font-bold outline-none text-base placeholder:text-slate-300"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  required
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 text-brand p-4 rounded-xl text-sm font-medium border border-red-100 flex items-start space-x-3 animate-in fade-in slide-in-from-top-2">
                <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-brand hover:bg-brand-hover disabled:bg-slate-200 disabled:text-slate-400 text-white font-black py-4 rounded-xl transition-all duration-300 shadow-lg shadow-brand/20 hover:shadow-xl hover:shadow-brand/30 flex items-center justify-center space-x-3 active:scale-[0.99] mt-2"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <span className="text-sm tracking-widest uppercase">Sign In</span>
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-10 pt-8 border-t border-slate-100">
            <div className="flex items-center justify-between text-brand">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Secure Connection</span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest">Developed by Ahmed Elsherbini</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
