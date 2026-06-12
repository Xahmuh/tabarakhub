import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';

interface ManualProductModalProps {
  isOpen: boolean;
  initialName: string;
  onClose: () => void;
  onSave: (data: { product_name: string; selling_price: number; agent_name: string; category: string; internal_code?: string }) => void;
}

export const ManualProductModal: React.FC<ManualProductModalProps> = ({ isOpen, initialName, onClose, onSave }) => {
  const [name, setName] = useState(initialName);
  const [price, setPrice] = useState(0);
  const [agent, setAgent] = useState('');
  const [category, setCategory] = useState('');
  const [internalCode, setInternalCode] = useState('');
  const fieldClass = "w-full h-11 bg-white border border-slate-200 rounded-lg px-3.5 text-sm font-semibold text-slate-900 outline-none focus:ring-4 focus:ring-red-500/10 focus:border-[#B91c1c] transition-all";
  const labelClass = "text-[11px] font-bold text-slate-500 uppercase tracking-wide";

  // Reset fields when opening or name change
  React.useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setPrice(0);
      setAgent('');
      setCategory('');
      setInternalCode('');
      // Heuristic: If initialName looks like a code (e.g. number or short alphanumeric), set it as code too
      if (/^[A-Z0-9-]{3,10}$/i.test(initialName)) {
        setInternalCode(initialName);
      }
    }
  }, [isOpen, initialName]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center p-3 sm:p-6 bg-slate-900/45 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-product-modal-title"
      aria-describedby="manual-product-modal-description"
    >
      <div className="bg-white w-full max-w-xl rounded-xl p-5 sm:p-6 shadow-xl shadow-slate-950/20 border border-slate-200 relative overflow-hidden animate-in zoom-in-95 duration-200">
        <span id="manual-product-modal-description" className="sr-only">Form for adding a manual deficit entry for a product not in the system.</span>

        <div className="flex justify-between items-start gap-4 mb-6 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#B91c1c] rounded-lg flex items-center justify-center text-white">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h3 id="manual-product-modal-title" className="text-xl font-black text-slate-900 tracking-tight">Manual Deficit</h3>
              <p className="text-slate-500 font-semibold text-xs">Record non-inventory SKU</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-all"
            aria-label="Close modal"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="space-y-4 mb-6 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-4">
            <div className="space-y-1.5">
              <label className={labelClass}>Full Product Name</label>
              <input
                className={fieldClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Augmentin 1g"
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Internal Code</label>
              <input
                className={fieldClass}
                value={internalCode}
                onChange={(e) => setInternalCode(e.target.value)}
                placeholder="e.g. 102933"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className={labelClass}>Agent / Supplier</label>
              <input
                className={fieldClass}
                value={agent}
                onChange={(e) => setAgent(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Therapeutic Category</label>
              <input
                className={fieldClass}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={labelClass}>Estimated Local Price (BHD)</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-[#B91c1c]">BHD</span>
              <input
                type="number"
                step="0.001"
                className={`${fieldClass} pl-16 font-mono`}
                value={price}
                onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 relative z-10">
          <button
            onClick={onClose}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave({ product_name: name, selling_price: price, agent_name: agent, category, internal_code: internalCode })}
            disabled={!name.trim()}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            <span>Commit Entry</span>
          </button>
        </div>
      </div>
    </div>
  );
};
