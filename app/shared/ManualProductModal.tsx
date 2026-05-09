import React, { useState } from 'react';
import { Tag, X, Plus, Package, Box } from 'lucide-react';

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
      className="fixed inset-0 z-[2000] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-xl animate-in fade-in duration-500"
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-product-modal-title"
      aria-describedby="manual-product-modal-description"
    >
      <div className="bg-white w-full max-w-2xl rounded-[3.5rem] p-12 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.3)] border border-white relative overflow-hidden animate-in zoom-in-95 duration-500">
        <span id="manual-product-modal-description" className="sr-only">Form for adding a manual deficit entry for a product not in the system.</span>
        <div className="absolute top-0 right-0 w-64 h-64 bg-red-50 rounded-full blur-3xl -mr-32 -mt-32"></div>

        <div className="flex justify-between items-start mb-12 relative z-10">
          <div className="flex items-center space-x-5">
            <div className="w-16 h-16 bg-[#B91c1c] rounded-[1.75rem] flex items-center justify-center text-white shadow-xl shadow-red-200">
              <Plus className="w-8 h-8" />
            </div>
            <div>
              <h3 id="manual-product-modal-title" className="text-3xl font-black text-slate-900 tracking-tighter">Manual Deficit</h3>
              <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[10px]">Record Non-Inventory SKU</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-3 bg-slate-100 hover:bg-slate-200 rounded-2xl transition-all"
          >
            <X className="w-6 h-6 text-slate-500" />
          </button>
        </div>

        <div className="space-y-8 mb-12 relative z-10">
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2 space-y-2">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-4">Full Product Name</label>
              <input
                className="w-full bg-slate-50 border border-slate-100 rounded-[1.5rem] p-6 text-lg font-black text-slate-800 outline-none focus:ring-8 focus:ring-red-500/5 focus:border-[#B91c1c] transition-all"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Augmentin 1g"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-4">Internal Code</label>
              <input
                className="w-full bg-slate-50 border border-slate-100 rounded-[1.5rem] p-6 text-lg font-black text-slate-800 outline-none focus:ring-8 focus:ring-red-500/5 focus:border-[#B91c1c] transition-all"
                value={internalCode}
                onChange={(e) => setInternalCode(e.target.value)}
                placeholder="e.g. 102933"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-4">Agent / Supplier</label>
              <input
                className="w-full bg-slate-50 border border-slate-100 rounded-[1.5rem] p-6 font-black text-slate-800 outline-none focus:ring-8 focus:ring-red-500/5 focus:border-[#B91c1c] transition-all"
                value={agent}
                onChange={(e) => setAgent(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-4">Therapeutic Category</label>
              <input
                className="w-full bg-slate-50 border border-slate-100 rounded-[1.5rem] p-6 font-black text-slate-800 outline-none focus:ring-8 focus:ring-red-500/5 focus:border-[#B91c1c] transition-all"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-4">Estimated Local Price (BHD)</label>
            <div className="relative">
              <span className="absolute left-6 top-1/2 -translate-y-1/2 font-black text-[#B91c1c]">BHD</span>
              <input
                type="number"
                step="0.001"
                className="w-full pl-20 bg-slate-50 border border-slate-100 rounded-[1.5rem] p-6 text-2xl font-mono font-black text-slate-800 outline-none focus:ring-8 focus:ring-red-500/5 focus:border-[#B91c1c] transition-all"
                value={price}
                onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
        </div>

        <div className="flex relative z-10">
          <button
            onClick={() => onSave({ product_name: name, selling_price: price, agent_name: agent, category, internal_code: internalCode })}
            className="flex-1 bg-[#B91c1c] hover:bg-[#991b1b] text-white font-black py-7 rounded-[2.25rem] shadow-2xl shadow-red-200 transition-all flex items-center justify-center space-x-4 active:scale-95 group"
          >
            <Plus className="w-7 h-7" />
            <span className="text-lg uppercase">Commit Custom Entry</span>
          </button>
        </div>
      </div>
    </div>
  );
};
