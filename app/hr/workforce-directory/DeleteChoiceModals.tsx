import React from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, Trash2, X, RefreshCw } from 'lucide-react';

export interface SingleDeleteModalProps {
  deletingEmpTarget: any | null;
  isRtl: boolean;
  onClose: () => void;
  onSoftDelete: (emp: any) => void;
  onHardDelete: (emp: any) => void;
}

export const SingleDeleteModal: React.FC<SingleDeleteModalProps> = ({
  deletingEmpTarget,
  isRtl,
  onClose,
  onSoftDelete,
  onHardDelete
}) => {
  if (!deletingEmpTarget || typeof window === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 text-slate-900 animate-in fade-in zoom-in duration-150">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl border border-amber-200">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-950">
              {isRtl ? `التعامل مع الموظف [${deletingEmpTarget.code}]` : `Manage Staff [${deletingEmpTarget.code}]`}
            </h3>
            <p className="text-xs font-bold text-slate-500">{deletingEmpTarget.full_name}</p>
          </div>
        </div>

        <div className="py-4 space-y-3 text-xs">
          <p className="text-slate-600 font-medium">
            {isRtl
              ? 'اختر طريقة التعامل المناسبة للحفاظ على سلامة التقارير والسجلات التاريخية:'
              : 'Choose the appropriate option to maintain audit log data integrity:'}
          </p>

          <button
            type="button"
            onClick={() => onSoftDelete(deletingEmpTarget)}
            className="w-full text-right p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/80 text-emerald-950 font-bold transition-all flex flex-col gap-1 group cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="font-black text-sm text-emerald-700">
                {isRtl ? '1️⃣ تعطيل الحساب (Soft Delete - موصى به)' : '1️⃣ Deactivate Account (Recommended)'}
              </span>
              <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded font-black">
                {isRtl ? 'الأفضل للـ HR' : 'Best Practice'}
              </span>
            </div>
            <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
              {isRtl
                ? 'يغير الحالة إلى (غير نشط Inactive). يخفي الموظف من القوائم التشغيلية، مع الحفاظ الكامل على البصمات ومبيعات التوصيل والسجلات.'
                : 'Marks status as Inactive. Hides staff from daily duty while preserving past attendance and delivery audit logs.'}
            </p>
          </button>

          <button
            type="button"
            onClick={() => onHardDelete(deletingEmpTarget)}
            className="w-full text-right p-3.5 rounded-xl border border-red-200 bg-red-50/50 hover:bg-red-100/70 text-red-950 font-bold transition-all flex flex-col gap-1 group cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="font-black text-sm text-red-700">
                {isRtl ? '2️⃣ حذف نهائي من النظام (Hard Delete)' : '2️⃣ Permanent Delete'}
              </span>
              <span className="text-[10px] bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded font-black">
                {isRtl ? 'حذف كلي' : 'Purge'}
              </span>
            </div>
            <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
              {isRtl
                ? 'يمسح الموظف تماماً من جميع الجداول والنظام. يُفضل استخدامه فقط إذا كانت الإضافة تمت عن طريق الخطأ.'
                : 'Completely purges employee record. Use only for accidental entries.'}
            </p>
          </button>
        </div>

        <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary text-xs px-4 py-2 cursor-pointer"
          >
            {isRtl ? 'إلغاء' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export interface FloatingBulkActionBarProps {
  selectedCount: number;
  totalCount: number;
  isRtl: boolean;
  onOpenBulkDelete: () => void;
  onClearSelection: () => void;
}

export const FloatingBulkActionBar: React.FC<FloatingBulkActionBarProps> = ({
  selectedCount,
  totalCount,
  isRtl,
  onOpenBulkDelete,
  onClearSelection
}) => {
  if (selectedCount <= 0 || typeof window === 'undefined') return null;

  return createPortal(
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[3000] flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl bg-slate-900/95 backdrop-blur-md border border-slate-700/80 text-white animate-in slide-in-from-bottom-5 duration-200">
      <div className="flex items-center gap-2">
        <span className="flex h-2.5 w-2.5 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
        </span>
        <span className="text-xs font-black text-slate-100 whitespace-nowrap">
          {isRtl
            ? `تم تحديد (${selectedCount}) موظف`
            : `(${selectedCount}) staff selected`}
        </span>
      </div>

      <div className="h-4 w-px bg-slate-700 mx-1" />

      <button
        type="button"
        onClick={onOpenBulkDelete}
        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-black shadow-md transition-all active:scale-95 cursor-pointer whitespace-nowrap"
      >
        <Trash2 className="w-3.5 h-3.5" />
        <span>
          {selectedCount === totalCount
            ? (isRtl ? `حذف الكل (${selectedCount})` : `Delete All (${selectedCount})`)
            : (isRtl ? `حذف المحدد (${selectedCount})` : `Delete Selected (${selectedCount})`)}
        </span>
      </button>

      <button
        type="button"
        onClick={onClearSelection}
        className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer whitespace-nowrap"
      >
        {isRtl ? 'إلغاء التحديد' : 'Deselect'}
      </button>
    </div>,
    document.body
  );
};

export interface BulkDeleteModalProps {
  isOpen: boolean;
  selectedEmps: any[];
  bulkDeleteLoading: boolean;
  isRtl: boolean;
  onClose: () => void;
  onBulkSoftDelete: () => void;
  onBulkHardDelete: () => void;
}

export const BulkDeleteModal: React.FC<BulkDeleteModalProps> = ({
  isOpen,
  selectedEmps,
  bulkDeleteLoading,
  isRtl,
  onClose,
  onBulkSoftDelete,
  onBulkHardDelete
}) => {
  if (!isOpen || selectedEmps.length === 0 || typeof window === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl p-6 text-slate-900 animate-in fade-in zoom-in duration-150 max-h-[90vh] flex flex-col">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100 shrink-0">
          <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl border border-rose-200">
            <Trash2 className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-black text-slate-950 truncate">
              {isRtl
                ? `إجراء جماعي على (${selectedEmps.length}) موظف`
                : `Bulk Action on (${selectedEmps.length}) Employees`}
            </h3>
            <p className="text-xs font-bold text-slate-500">
              {isRtl
                ? 'اختر نوع الحذف أو التعطيل للموظفين المحددين'
                : 'Choose delete or deactivation method for selected staff'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => !bulkDeleteLoading && onClose()}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
            disabled={bulkDeleteLoading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center justify-between text-xs font-bold text-slate-600 mb-2">
            <span>{isRtl ? 'الموظفون المشمولون بالإجراء:' : 'Included Employees:'}</span>
            <span className="text-slate-400 font-mono text-[11px]">{selectedEmps.length} {isRtl ? 'موظف' : 'staff'}</span>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200/80 custom-scrollbar">
            {selectedEmps.slice(0, 15).map(e => (
              <span
                key={e.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[11px] font-bold text-slate-800 shadow-2xs"
              >
                <span className="font-mono text-brand font-black">{e.code}</span>
                <span className="text-slate-600 truncate max-w-[120px]">{e.full_name}</span>
              </span>
            ))}
            {selectedEmps.length > 15 && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-200 text-[11px] font-bold text-slate-600">
                +{selectedEmps.length - 15} {isRtl ? 'آخرين' : 'more'}
              </span>
            )}
          </div>
        </div>

        <div className="py-4 space-y-3 text-xs overflow-y-auto custom-scrollbar flex-1">
          <p className="text-slate-600 font-medium">
            {isRtl
              ? 'اختر طريقة التعامل المناسبة للحفاظ على سلامة التقارير والسجلات التاريخية:'
              : 'Choose the appropriate option to maintain audit log data integrity:'}
          </p>

          <button
            type="button"
            disabled={bulkDeleteLoading}
            onClick={onBulkSoftDelete}
            className="w-full text-right p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/80 text-emerald-950 font-bold transition-all flex flex-col gap-1 group cursor-pointer disabled:opacity-50"
          >
            <div className="flex items-center justify-between">
              <span className="font-black text-sm text-emerald-700 flex items-center gap-1.5">
                <span>1️⃣</span>
                <span>{isRtl ? `تعطيل الحسابات (${selectedEmps.length}) (Soft Delete - موصى به)` : `Deactivate Accounts (${selectedEmps.length}) (Recommended)`}</span>
              </span>
              <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded font-black">
                {isRtl ? 'الأفضل للـ HR' : 'Best Practice'}
              </span>
            </div>
            <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
              {isRtl
                ? 'يغير الحالة إلى (غير نشط Inactive). يخفي الموظفين من القوائم التشغيلية، مع الحفاظ الكامل على البصمات ومبيعات التوصيل والسجلات التاريخية.'
                : 'Marks status as Inactive for all selected staff. Preserves historical attendance and delivery audit logs.'}
            </p>
          </button>

          <button
            type="button"
            disabled={bulkDeleteLoading}
            onClick={onBulkHardDelete}
            className="w-full text-right p-3.5 rounded-xl border border-rose-200 bg-rose-50/50 hover:bg-rose-100/70 text-rose-950 font-bold transition-all flex flex-col gap-1 group cursor-pointer disabled:opacity-50"
          >
            <div className="flex items-center justify-between">
              <span className="font-black text-sm text-rose-700 flex items-center gap-1.5">
                <span>2️⃣</span>
                <span>{isRtl ? `حذف نهائي كلي (${selectedEmps.length}) من النظام (Hard Delete)` : `Permanently Delete All (${selectedEmps.length})`}</span>
              </span>
              <span className="text-[10px] bg-rose-100 text-rose-700 border border-rose-200 px-2 py-0.5 rounded font-black">
                {isRtl ? 'حذف دائم' : 'Purge'}
              </span>
            </div>
            <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
              {isRtl
                ? 'يمسح جميع الموظفين المحددين نهائياً من قاعدة البيانات وجداول التخصيص والمحليات. تحذير: لا يمكن التراجع عن هذا الإجراء!'
                : 'Completely purges all selected employees from the database and assignments. Warning: this cannot be undone!'}
            </p>
          </button>
        </div>

        <div className="pt-3 border-t border-slate-100 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500 font-medium">
            {bulkDeleteLoading && (
              <span className="inline-flex items-center gap-1.5 text-brand font-bold">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>{isRtl ? 'جاري تنفيذ العملية...' : 'Processing bulk action...'}</span>
              </span>
            )}
          </div>
          <button
            type="button"
            disabled={bulkDeleteLoading}
            onClick={onClose}
            className="btn-secondary text-xs px-4 py-2 cursor-pointer disabled:opacity-50"
          >
            {isRtl ? 'إلغاء' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
