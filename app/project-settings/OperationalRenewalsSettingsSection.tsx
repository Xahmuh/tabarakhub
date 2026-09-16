import React, { useState, useEffect } from 'react';
import {
  Bell, Save, CheckCircle2, AlertTriangle, ShieldCheck,
  Building2, UserCheck, Clock, Settings2, RefreshCw, Truck
} from 'lucide-react';
import Swal from 'sweetalert2';
import { OperationalRenewalSettings, OperationalRenewalType } from '../../types';
import { operationalRenewalService, DEFAULT_SETTINGS } from '../../services/operationalRenewalService';

export const OperationalRenewalsSettingsSection: React.FC = () => {
  const [settings, setSettings] = useState<OperationalRenewalSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    operationalRenewalService.getSettings()
      .then(s => {
        setSettings(s);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleToggleType = (type: OperationalRenewalType) => {
    setSettings(prev => {
      const exists = prev.enabledTypes.includes(type);
      const next = exists
        ? prev.enabledTypes.filter(t => t !== type)
        : [...prev.enabledTypes, type];
      return { ...prev, enabledTypes: next };
    });
  };

  const handleToggleInterval = (days: number) => {
    setSettings(prev => {
      const exists = prev.reminderIntervals.includes(days);
      const next = exists
        ? prev.reminderIntervals.filter(d => d !== days)
        : [...prev.reminderIntervals, days].sort((a, b) => b - a);
      return { ...prev, reminderIntervals: next };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await operationalRenewalService.updateSettings(settings);
      Swal.fire({
        icon: 'success',
        title: 'Settings Saved',
        text: 'Operational alert thresholds and reminder configuration have been updated.',
        confirmButtonColor: '#b91c1c'
      });
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Save Failed',
        text: err?.message || 'Failed to update settings.',
        confirmButtonColor: '#b91c1c'
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
        <RefreshCw className="h-6 w-6 text-brand animate-spin mx-auto mb-2" />
        <p className="text-xs font-bold text-slate-600">Loading renewal settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Bell className="h-5 w-5 text-brand" />
            Operational Alerts & Renewals Configuration
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure dynamic expiry calculation thresholds, enabled document categories, and reminder schedules.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-brand hover:bg-brand-hover text-white rounded-xl text-xs font-black transition-all shadow-sm disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" />
          <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
        </button>
      </div>

      {/* 1. Dynamic Alert Thresholds */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
          <Clock className="h-4 w-4 text-brand" />
          Alert Severity Thresholds (Days to Expiry)
        </h4>
        <p className="text-xs text-slate-500">
          The compliance engine dynamically calculates remaining days from each record&apos;s expiry date and applies these configurable thresholds.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          {/* Critical Threshold */}
          <div className="p-4 bg-rose-50/50 border border-rose-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-rose-800 uppercase tracking-wider">Critical (&le; Days)</span>
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            </div>
            <input
              type="number"
              min={1}
              max={30}
              value={settings.criticalDays}
              onChange={e => setSettings(prev => ({ ...prev, criticalDays: Number(e.target.value) || 7 }))}
              className="w-full text-base font-black text-rose-700 bg-white border border-rose-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-rose-400"
            />
            <span className="text-[10px] text-rose-600 font-medium block">
              Default: 7 days. Immediate action required.
            </span>
          </div>

          {/* Urgent Threshold */}
          <div className="p-4 bg-amber-50/50 border border-amber-200 rounded-xl space-y-2">
            <span className="text-xs font-black text-amber-800 uppercase tracking-wider block">Urgent (&le; Days)</span>
            <input
              type="number"
              min={settings.criticalDays + 1}
              max={60}
              value={settings.urgentDays}
              onChange={e => setSettings(prev => ({ ...prev, urgentDays: Number(e.target.value) || 30 }))}
              className="w-full text-base font-black text-amber-700 bg-white border border-amber-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <span className="text-[10px] text-amber-600 font-medium block">
              Default: 30 days. Renewal should be initiated.
            </span>
          </div>

          {/* Warning Threshold */}
          <div className="p-4 bg-yellow-50/50 border border-yellow-200 rounded-xl space-y-2">
            <span className="text-xs font-black text-yellow-800 uppercase tracking-wider block">Warning (&le; Days)</span>
            <input
              type="number"
              min={settings.urgentDays + 1}
              max={90}
              value={settings.warningDays}
              onChange={e => setSettings(prev => ({ ...prev, warningDays: Number(e.target.value) || 60 }))}
              className="w-full text-base font-black text-yellow-700 bg-white border border-yellow-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />
            <span className="text-[10px] text-yellow-600 font-medium block">
              Default: 60 days. Upcoming renewal notice.
            </span>
          </div>

          {/* Upcoming Threshold */}
          <div className="p-4 bg-sky-50/50 border border-sky-200 rounded-xl space-y-2">
            <span className="text-xs font-black text-sky-800 uppercase tracking-wider block">Upcoming (&le; Days)</span>
            <input
              type="number"
              min={settings.warningDays + 1}
              max={180}
              value={settings.upcomingDays}
              onChange={e => setSettings(prev => ({ ...prev, upcomingDays: Number(e.target.value) || 90 }))}
              className="w-full text-base font-black text-sky-700 bg-white border border-sky-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
            <span className="text-[10px] text-sky-600 font-medium block">
              Default: 90 days. Monitor on dashboard.
            </span>
          </div>
        </div>
      </div>

      {/* 2. Active Renewal Categories */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
          <Settings2 className="h-4 w-4 text-brand" />
          Active Renewal Categories
        </h4>
        <p className="text-xs text-slate-500">
          Enable or disable compliance categories monitored by the system.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 pt-2">
          {[
            { type: 'CR' as OperationalRenewalType, label: 'Commercial Reg (CR)', desc: 'Company & branch CR expiries', icon: Building2 },
            { type: 'NHRA_PHARMACY' as OperationalRenewalType, label: 'NHRA Pharmacy', desc: 'Pharmacy facility licenses & branches', icon: ShieldCheck },
            { type: 'NHRA_PHARMACIST' as OperationalRenewalType, label: 'NHRA Pharmacist', desc: 'Staff pharmacist practice licenses', icon: UserCheck },
            { type: 'WORK_PERMIT' as OperationalRenewalType, label: 'Work Permits (LMRA)', desc: 'Employee visa & work permits', icon: UserCheck },
            { type: 'FLEET_VEHICLE' as OperationalRenewalType, label: 'Fleet Vehicles', desc: 'Vehicle registration & insurance expiries', icon: Truck },
            { type: 'OTHER' as OperationalRenewalType, label: 'Other Regulatory', desc: 'Municipal, civil defense, agreements', icon: AlertTriangle }
          ].map(item => {
            const isEnabled = settings.enabledTypes.includes(item.type);
            return (
              <div
                key={item.type}
                onClick={() => handleToggleType(item.type)}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                  isEnabled ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-500 opacity-60'
                }`}
              >
                <div>
                  <item.icon className={`h-5 w-5 mb-2 ${isEnabled ? 'text-amber-400' : 'text-slate-400'}`} />
                  <span className="text-xs font-black block">{item.label}</span>
                  <span className={`text-[10px] mt-0.5 block ${isEnabled ? 'text-slate-300' : 'text-slate-400'}`}>{item.desc}</span>
                </div>
                <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-between text-[10px] font-bold">
                  <span>{isEnabled ? 'Enabled' : 'Disabled'}</span>
                  <span className={`w-2 h-2 rounded-full ${isEnabled ? 'bg-emerald-400' : 'bg-slate-300'}`} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Reminder Intervals */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
          <Bell className="h-4 w-4 text-brand" />
          Scheduled Reminder Intervals
        </h4>
        <p className="text-xs text-slate-500">
          Select the active day intervals at which reminders and compliance notifications should be triggered.
        </p>

        <div className="flex flex-wrap gap-2 pt-2">
          {[90, 60, 45, 30, 14, 7, 3, 1].map(days => {
            const isSelected = settings.reminderIntervals.includes(days);
            return (
              <button
                key={days}
                type="button"
                onClick={() => handleToggleInterval(days)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
                  isSelected
                    ? 'bg-brand text-white border-brand shadow-xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {days} Days Before
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Default Responsible Person */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
          <UserCheck className="h-4 w-4 text-brand" />
          Default Assigned Owner
        </h4>
        <p className="text-xs text-slate-500">
          Optional default responsible person assigned when new renewals are created without an explicit owner.
        </p>

        <div className="max-w-md">
          <input
            type="text"
            value={settings.defaultResponsibleUserName || ''}
            onChange={e => setSettings(prev => ({ ...prev, defaultResponsibleUserName: e.target.value }))}
            placeholder="e.g. Operations Manager or HR Department"
            className="w-full text-xs font-bold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
        </div>
      </div>
    </div>
  );
};
