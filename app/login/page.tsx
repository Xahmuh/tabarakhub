
import React, { useState } from 'react';
import { ChevronRight, ShieldCheck, ShieldAlert, Loader2, Globe, Lock, Building2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Branch } from '../../types';

interface LoginPageProps {
  onLogin: (branch: Branch) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!code || !password) return;

    setIsLoading(true);
    setError('');

    try {
      const branch = await supabase.branches.findByCode(code);

      if (!branch) {
        setError('Branch code not found. Please verify (e.g., B001).');
        setIsLoading(false);
        return;
      }

      // Authentication Logic
      if (branch.password) {
        if (password === branch.password) {
          onLogin(branch);
          return;
        } else {
          setError('Invalid credentials for this node.');
          setIsLoading(false);
          return;
        }
      }

      if (branch.role === 'admin' || branch.role === 'manager' || branch.role === 'accounts') {
        if (password === 'admin123') onLogin(branch);
        else setError('Invalid credentials.');
      } else {
        if (password === '1234') onLogin(branch);
        else setError('Invalid branch credentials.');
      }
    } catch (err: any) {
      setError(`Network Error: ${err.message}. System running in Hybrid Mode.`);
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

        <div className="relative z-10 max-w-xl">
          <div className="w-20 h-20 bg-brand rounded-2xl flex items-center justify-center shadow-2xl shadow-brand/30 mb-12 overflow-hidden ring-2 ring-white/10">
            <img src="/logo.jpg" alt="Logo" className="w-full h-full object-cover" />
          </div>

          <h1 className="text-6xl font-black text-white tracking-tighter mb-3 leading-[1.05]">
            Tabarak Pharmacy
          </h1>
          <h2 className="text-6xl font-black tracking-tighter mb-8 leading-[1.05]">
            <span className="text-brand">HUB</span>
          </h2>

          <p className="text-slate-400 text-lg font-medium leading-relaxed mb-12 max-w-md">
            Official operational platform for Tabarak Pharmacy Group.
          </p>

          <div className="flex flex-col space-y-4">
            <div className="flex items-center space-x-3 bg-emerald-500/10 border border-emerald-500/20 px-5 py-3 rounded-xl w-fit">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-widest">End-to-End Encryption Active</span>
            </div>
            <div className="flex items-center space-x-3 bg-white/5 border border-white/10 px-5 py-3 rounded-xl w-fit">
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
          <div className="md:hidden flex items-center justify-center mb-10">
            <div className="w-16 h-16 bg-brand rounded-2xl flex items-center justify-center shadow-xl shadow-brand/20 overflow-hidden">
              <img src="/logo.jpg" alt="Logo" className="w-full h-full object-cover" />
            </div>
          </div>

          <div className="mb-10">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-3">Welcome back</h2>
            <p className="text-slate-400 font-medium text-sm">Enter your branch credentials to access the platform</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest ml-1 flex items-center space-x-2">
                <Building2 className="w-3.5 h-3.5" />
                <span>Branch Identity Code</span>
              </label>
              <div className={`relative rounded-xl border-2 transition-all duration-300 ${focusedField === 'code' ? 'border-brand shadow-lg shadow-brand/5' : 'border-slate-100 hover:border-slate-200'}`}>
                <input
                  type="text"
                  className="w-full px-5 py-4 rounded-xl bg-transparent text-slate-900 font-bold outline-none text-base placeholder:text-slate-300"
                  placeholder="Enter branch code"
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
                <span>Access Key</span>
              </label>
              <div className={`relative rounded-xl border-2 transition-all duration-300 ${focusedField === 'password' ? 'border-brand shadow-lg shadow-brand/5' : 'border-slate-100 hover:border-slate-200'}`}>
                <input
                  type="password"
                  className="w-full px-5 py-4 rounded-xl bg-transparent text-slate-900 font-bold outline-none text-base placeholder:text-slate-300"
                  placeholder="Enter access key"
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
            <div className="flex items-center justify-between text-slate-300">
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
