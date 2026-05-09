import React, { useState } from 'react';
import { 
  Bell, 
  Mail, 
  Clock, 
  Shield, 
  ChevronRight, 
  Save, 
  Loader2, 
  CheckCircle2, 
  FileText, 
  AlertTriangle 
} from 'lucide-react';

export const SettingsPanel: React.FC = () => {
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }, 1000);
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-slate-100 text-slate-600 rounded-xl">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 tracking-tight">Automations & Security</h3>
            <p className="text-xs text-slate-500 font-medium">Configure alerts and report generation</p>
          </div>
        </div>
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="px-4 py-2 bg-brand text-white text-sm font-bold rounded-xl hover:bg-brand-600 transition-all flex items-center gap-2 shadow-lg shadow-brand/20"
        >
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
        <div className="p-6 space-y-6">
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Bell className="w-3.5 h-3.5" /> Notifications
          </h4>

          <div className="space-y-4">
            <label className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-brand/20 transition-all cursor-pointer group">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-lg text-rose-500 shadow-sm">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-700">CEO Critical Alert</p>
                  <p className="text-[10px] text-slate-500">Email CEO if score drops below 2.5</p>
                </div>
              </div>
              <input type="checkbox" defaultChecked className="w-5 h-5 rounded-md text-brand focus:ring-brand border-slate-300" />
            </label>

            <label className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-brand/20 transition-all cursor-pointer group">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-lg text-brand shadow-sm">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-700">Monthly PDF Report</p>
                  <p className="text-[10px] text-slate-500">Send summary to stakeholders on 1st</p>
                </div>
              </div>
              <input type="checkbox" defaultChecked className="w-5 h-5 rounded-md text-brand focus:ring-brand border-slate-300" />
            </label>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Mail className="w-3.5 h-3.5" /> Recipients
          </h4>
          
          <div className="space-y-3">
            <div className="relative">
              <input 
                type="text" 
                placeholder="Add email address..."
                className="w-full p-3 pl-10 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-brand focus:ring-brand outline-none"
              />
              <Mail className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 flex items-center gap-2">
                ceo@tabarak.com <XCircle className="w-3 h-3 cursor-pointer" />
              </span>
              <span className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-600 flex items-center gap-2">
                hr.manager@tabarak.com <XCircle className="w-3 h-3 cursor-pointer" />
              </span>
            </div>
          </div>

          <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-start gap-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            <p className="text-[10px] font-medium text-emerald-800 leading-relaxed">
              Resend API is connected. Last successful report sent: May 1st, 2024.
            </p>
          </div>
        </div>
      </div>

      {showSuccess && (
        <div className="absolute top-6 right-6 animate-in fade-in slide-in-from-top-4">
          <div className="bg-emerald-500 text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 text-sm font-bold">
            <CheckCircle2 className="w-4 h-4" />
            Settings Saved
          </div>
        </div>
      )}
    </div>
  );
};

const XCircle = ({ className, onClick }: { className?: string, onClick?: () => void }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="24" 
    height="24" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
    onClick={onClick}
  >
    <circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>
  </svg>
);
