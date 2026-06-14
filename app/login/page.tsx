
import React, { useState } from 'react';
import { ChevronRight, ShieldCheck, ShieldAlert, Loader2, Lock, Building2 } from 'lucide-react';
import { clientConfig } from '../../config/clientConfig';
import { MaintenanceSettings } from '../../types';

const HUB_LOGO_URL = '/tabarak-logo.svg';

interface LoginPageProps {
  onLogin: (identifier: string, password: string) => Promise<void>;
  settings?: MaintenanceSettings | null;
  notice?: string | null;
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

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin, settings, notice }) => {
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const loginBadges = (settings?.loginBadges || []).filter(Boolean).slice(0, 6);
  const hubLogoUrl = settings?.hubLogoUrl?.trim() || HUB_LOGO_URL;
  const pharmacyLogoUrl = settings?.pharmacyLogoUrl?.trim() || clientConfig.logoUrl;

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
      <div className="hidden md:flex md:w-[55%] bg-slate-950 items-center justify-center p-12 relative overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 w-full h-full opacity-[0.015] pointer-events-none">
            <svg width="100%" height="100%"><defs><pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M 50 0 L 0 0 0 50" fill="none" stroke="white" strokeWidth="1" /></pattern></defs><rect width="100%" height="100%" fill="url(#grid)" /></svg>
          </div>
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-brand/10 rounded-full blur-[120px]"></div>
          <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] bg-brand/5 rounded-full blur-[100px]"></div>
        </div>

        <div className="relative z-10 flex w-full max-w-4xl flex-col items-center text-center">
          <img
            src={hubLogoUrl}
            alt="Tabarak HUB logo"
            className="login-hub-wordmark w-full max-w-[720px] object-contain xl:max-w-[820px]"
          />

          {loginBadges.length > 0 && (
            <div className="mt-8 flex flex-col items-center space-y-3">
              {loginBadges.map((badge, index) => (
                <div key={`${badge}-${index}`} className="flex w-fit items-center rounded-xl border border-white/10 bg-white/5 px-5 py-3">
                  <span className="text-xs font-bold uppercase tracking-widest text-slate-300">{badge}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <p className="absolute bottom-7 left-7 z-10 text-left text-xs font-black uppercase tracking-[0.18em] text-white">
          Developed by Ahmed Elsherbini
        </p>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center overflow-y-auto p-6 md:px-14 md:py-10 relative">
        {/* Subtle background */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50/50 to-white pointer-events-none"></div>

        <div className="w-full max-w-[480px] relative z-10">
          <div className="mb-6 flex flex-col items-center justify-center text-center">
            <div className="flex items-center justify-center gap-3 rounded-lg border border-slate-200/70 bg-white/80 px-4 py-3 shadow-lg shadow-slate-950/5">
              <div className="login-logo-motion flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-brand shadow-lg shadow-brand/15 ring-1 ring-brand/10 md:h-11 md:w-11">
                <img
                  src={pharmacyLogoUrl}
                  alt="Tabarak Pharmacy logo"
                  className="h-full w-full object-cover"
                />
              </div>
              <h1 className="text-lg font-black tracking-normal text-slate-950 md:text-xl">Tabarak Pharmacy</h1>
            </div>
            {loginBadges.length > 0 && (
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {loginBadges.map((badge, index) => (
                  <span key={`${badge}-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500">
                    {badge}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-slate-200/80 bg-white/95 p-6 shadow-2xl shadow-slate-950/5 md:p-8">
            <div className="mb-7">
              <h2 className="text-2xl font-black tracking-tight text-slate-900">Sign in</h2>
              <p className="mt-2 text-sm font-semibold text-slate-400">Access your pharmacy operations workspace.</p>
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
                    placeholder="T001 or email"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    onFocus={() => setFocusedField('code')}
                    onBlur={() => setFocusedField(null)}
                    required
                  />
                </div>
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

              {(error || notice) && (
                <div className={`${error ? 'bg-red-50 text-brand border-red-100' : 'bg-amber-50 text-amber-800 border-amber-100'} p-4 rounded-xl text-sm font-medium border flex items-start space-x-3 animate-in fade-in slide-in-from-top-2`}>
                  <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
                  <span>{error || notice}</span>
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

            <div className="mt-7 pt-5 border-t border-slate-100">
              <div className="flex justify-center text-brand">
                <div className="flex items-center justify-center space-x-2">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Secure Connection</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
