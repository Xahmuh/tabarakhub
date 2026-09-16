import React from 'react';
import { Printer, X, FileText, Calendar, Building2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { OperationalRenewalRecord } from '../../types';
import { getOperationalEntityDisplayName } from '../../services/operationalRenewalService';
import { printOperationalRenewalsReport } from './utils/exportRenewals';

interface RenewalReportPrintModalProps {
  records: OperationalRenewalRecord[];
  activeFilterLabel?: string;
  onClose: () => void;
}

export const RenewalReportPrintModal: React.FC<RenewalReportPrintModalProps> = ({
  records,
  activeFilterLabel = 'All Operational Records',
  onClose
}) => {
  const expiredCount = records.filter(r => r.severity === 'EXPIRED').length;
  const criticalCount = records.filter(r => r.severity === 'CRITICAL').length;
  const urgentCount = records.filter(r => r.severity === 'URGENT').length;
  const warningCount = records.filter(r => r.severity === 'WARNING').length;

  const handlePrint = () => {
    printOperationalRenewalsReport(records, activeFilterLabel);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-100 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Printer className="h-5 w-5 text-brand" />
              Operational Compliance & Renewal Report
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Print-ready executive report for operational licenses, CRs, and work permits.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Report Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-center">
            <span className="text-[10px] font-black uppercase tracking-wider text-rose-600 block">Expired</span>
            <span className="text-xl font-black text-rose-700">{expiredCount}</span>
          </div>
          <div className="p-3 bg-rose-50/60 border border-rose-200/80 rounded-xl text-center">
            <span className="text-[10px] font-black uppercase tracking-wider text-rose-600 block">Critical (&le; 7 Days)</span>
            <span className="text-xl font-black text-rose-700">{criticalCount}</span>
          </div>
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 block">Urgent (&le; 30 Days)</span>
            <span className="text-xl font-black text-amber-700">{urgentCount}</span>
          </div>
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-center">
            <span className="text-[10px] font-black uppercase tracking-wider text-yellow-700 block">Warning (31–60 Days)</span>
            <span className="text-xl font-black text-yellow-700">{warningCount}</span>
          </div>
        </div>

        {/* Preview List */}
        <div className="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 font-black border-b border-slate-200 sticky top-0">
              <tr>
                <th className="p-2.5">Priority</th>
                <th className="p-2.5">Entity</th>
                <th className="p-2.5">Document</th>
                <th className="p-2.5">Expiry Date</th>
                <th className="p-2.5 text-center">Days Left</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.map(r => (
                <tr key={r.id} className="hover:bg-slate-50/50">
                  <td className="p-2.5 font-bold">
                    <span className={`text-[10px] px-2 py-0.5 rounded font-black ${
                      r.severity === 'EXPIRED' ? 'bg-rose-100 text-rose-700' :
                      r.severity === 'CRITICAL' ? 'bg-rose-100 text-rose-700' :
                      r.severity === 'URGENT' ? 'bg-amber-100 text-amber-700' :
                      r.severity === 'WARNING' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-emerald-100 text-emerald-800'
                    }`}>
                      {r.severity}
                    </span>
                  </td>
                  <td className="p-2.5 font-bold text-slate-800">{getOperationalEntityDisplayName(r)}</td>
                  <td className="p-2.5 text-slate-600">{r.documentType} ({r.documentNumber})</td>
                  <td className="p-2.5 font-semibold text-slate-900">{r.expiryDate}</td>
                  <td className="p-2.5 text-center font-bold">
                    {r.daysRemaining < 0 ? `-${Math.abs(r.daysRemaining)}d` : `${r.daysRemaining}d`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-slate-100 rounded-xl"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-5 py-2 text-xs font-black text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-all shadow-sm"
          >
            <Printer className="h-3.5 w-3.5" />
            Open Print View
          </button>
        </div>
      </div>
    </div>
  );
};
