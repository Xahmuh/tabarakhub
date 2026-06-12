
import React, { useState, useEffect } from 'react';
import {
  Save,
  Trash2,
  PackageSearch,
  ScanLine,
  ArrowRight,
  Plus,
  Minus,
  Zap,
  Hash,
  Box,
  UserCircle,
  CheckCircle2,
  FileText,
  Target,
  Sparkles,
  Package,
  Layers,
  ShieldCheck,
  ChevronRight,
  RefreshCcw,
  ArrowLeft,
  AlertTriangle,
  AlertOctagon,
  AlertCircle,
  Loader2,
  X
} from 'lucide-react';
import { ProductSearch, ManualProductModal, BarcodeScanner } from '../shared';
import { Product, LostSale, Branch, Pharmacist, Shortage } from '../../types';
import { supabase } from '../../lib/supabase';
import { formatCurrency } from '../../utils/calculations';
import { getPriceIncludingVat } from '../../utils/vat';

interface POSPageProps {
  branch: Branch;
  pharmacist: Pharmacist;
  permissions: any[];
  onBackToPharmacist: () => void;
}

type Mode = 'sales' | 'shortages';

export const POSPage: React.FC<POSPageProps> = ({ branch, pharmacist, permissions, onBackToPharmacist }) => {
  const getPermission = (feature: string) => {
    if (branch.role === 'manager') return 'edit';
    const level = permissions.find(p => p.featureName === feature)?.accessLevel || 'edit';
    // If a branch is in POS, they should have logging access ('edit') by default
    return level === 'read' ? 'edit' : level;
  };

  const salesPerm = getPermission('lost_sales');
  const shortagesPerm = getPermission('shortages');

  const initialMode = salesPerm !== 'none' ? 'sales' : 'shortages';
  const [mode, setMode] = useState<Mode>(initialMode);
  const [cart, setCart] = useState<any[]>([]);
  const [manualQuery, setManualQuery] = useState('');
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [modeSwitchTarget, setModeSwitchTarget] = useState<Mode | null>(null);

  // --- Draft Persistence Management ---
  const DRAFT_KEY = `tabarak_pos_draft_${branch.id}_${pharmacist.id}`;

  useEffect(() => {
    const savedDraft = localStorage.getItem(DRAFT_KEY);
    if (savedDraft) {
      try {
        const { mode: savedMode, cart: savedCart } = JSON.parse(savedDraft);
        setMode(savedMode);
        setCart(savedCart);
      } catch (e) {
        console.error("Failed to parse POS draft:", e);
      }
    }
  }, []);

  useEffect(() => {
    if (cart.length > 0) {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ mode, cart }));
    } else {
      localStorage.removeItem(DRAFT_KEY);
    }
  }, [cart, mode, DRAFT_KEY]);

  useEffect(() => {
    const handleToast = (e: any) => {
      setToastMessage(e.detail);
      setTimeout(() => setToastMessage(null), 5000);
    };
    window.addEventListener('tabarak_toast', handleToast);
    return () => window.removeEventListener('tabarak_toast', handleToast);
  }, []);

  const switchMode = (newMode: Mode) => {
    if (newMode === mode) return;
    if (cart.length > 0) {
      setModeSwitchTarget(newMode);
      return;
    }
    setCart([]);
    setMode(newMode);
  };

  const confirmModeSwitch = () => {
    if (!modeSwitchTarget) return;
    setCart([]);
    setMode(modeSwitchTarget);
    setModeSwitchTarget(null);
  };

  const addItem = (product: Product) => {
    const existingIdx = cart.findIndex(i => i.productId === product.id);

    if (existingIdx !== -1 && mode === 'sales') {
      updateQty(existingIdx, (cart[existingIdx].quantity || 1) + 1);
      return;
    }

    if (existingIdx !== -1 && mode === 'shortages') {
      setToastMessage({ message: 'Item already in shortage list', type: 'info' });
      return;
    }

    if (mode === 'sales') {
      setCart([{
        branchId: branch.id,
        pharmacistId: pharmacist.id,
        pharmacistName: pharmacist.name,
        productId: product.isManual ? null : product.id,
        productName: product.name,
        agentName: product.agent,
        category: product.category,
        unitPrice: getPriceIncludingVat(Number(product.defaultPrice || 0), product.vatEnabled, product.vatRate),
        quantity: 1,
        priceSource: product.isManual ? 'manual' : 'db',
        isManual: !!product.isManual,
        alternativeGiven: false,
        internalTransfer: false,
        internalCode: product.internalCode,
        notes: ''
      }, ...cart]);
    } else {
      setCart([{
        branchId: branch.id,
        pharmacistId: pharmacist.id,
        pharmacistName: pharmacist.name,
        productId: product.id,
        productName: product.name,
        agentName: product.agent,
        status: 'Out of Stock',
        internalCode: product.internalCode,
        notes: ''
      }, ...cart]);
    }
  };

  const updateQty = (idx: number, qty: number) => {
    if (qty < 1) return;
    const newCart = [...cart];
    newCart[idx] = { ...newCart[idx], quantity: qty };
    setCart(newCart);
  };

  const toggleAlternative = (idx: number) => {
    const newCart = [...cart];
    const isNowActive = !newCart[idx].alternativeGiven;
    newCart[idx] = {
      ...newCart[idx],
      alternativeGiven: isNowActive,
      internalTransfer: isNowActive ? false : newCart[idx].internalTransfer
    };
    setCart(newCart);
  };

  const toggleTransfer = (idx: number) => {
    const newCart = [...cart];
    const isNowActive = !newCart[idx].internalTransfer;
    newCart[idx] = {
      ...newCart[idx],
      internalTransfer: isNowActive,
      alternativeGiven: isNowActive ? false : newCart[idx].alternativeGiven
    };
    setCart(newCart);
  };

  const updatePrice = (idx: number, price: number) => {
    const newCart = [...cart];
    newCart[idx] = { ...newCart[idx], unitPrice: price, priceSource: 'manual' };
    setCart(newCart);
  };

  const updateNotes = (idx: number, notes: string) => {
    const newCart = [...cart];
    newCart[idx] = { ...newCart[idx], notes };
    setCart(newCart);
  };

  const updateStatus = (idx: number, status: 'Low' | 'Critical' | 'Out of Stock') => {
    const newCart = [...cart];
    newCart[idx] = { ...newCart[idx], status };
    setCart(newCart);
  };

  const removeItem = (idx: number) => {
    setCart(cart.filter((_, i) => i !== idx));
  };

  const handleCheckout = async () => {
    if (cart.length === 0 || isSubmitting) return;
    const commonTimestamp = new Date().toISOString();
    setIsSubmitting(true);

    try {
      if (mode === 'sales') {
        for (const item of cart) {
          await supabase.sales.insert({ ...item, timestamp: commonTimestamp } as any);
          await supabase.shortages.create({
            branchId: item.branchId,
            pharmacistId: item.pharmacistId,
            pharmacistName: item.pharmacistName,
            productId: item.productId,
            productName: item.productName,
            agentName: item.agentName,
            status: 'Out of Stock',
            timestamp: commonTimestamp,
            internalCode: item.internalCode,
            notes: `Auto-generated from Lost Sale: ${item.notes || ''}`
          } as any);
        }
      } else {
        for (const item of cart) {
          await supabase.shortages.create({ ...item, timestamp: commonTimestamp } as any);
        }
      }

      window.dispatchEvent(new CustomEvent('tabarak_toast', {
        detail: { message: `Successfully logged ${cart.length} items`, type: 'success' }
      }));

      localStorage.removeItem(DRAFT_KEY);
      setCart([]);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      console.error("Checkout Error:", err);
      setToastMessage({ message: `System Error: ${(err as any).message}`, type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleScan = async (code: string) => {
    const results = await supabase.products.search(code, branch.id);
    const product = results.find(p => p.internationalCode === code || p.internalCode === code);
    if (product) {
      addItem(product);
    } else {
      setManualQuery(code);
      setIsManualModalOpen(true);
    }
    setIsScannerOpen(false);
  };

  const grandTotal = cart.reduce((sum, item) => sum + ((Number(item.unitPrice) || 0) * (Number(item.quantity) || 0)), 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-0 h-full page-enter font-sans">
      {/* Search & Cart Area */}
      <div className="lg:col-span-8 flex flex-col gap-5">
        {branch.isItemsEntryEnabled !== false && (
          <div className="flex flex-col md:flex-row items-center gap-3">
            <div className="flex-1 w-full relative">
              <ProductSearch
                onSelect={addItem}
                onManual={(q) => { setManualQuery(q); setIsManualModalOpen(true); }}
              />
            </div>
            <button
              onClick={() => setIsScannerOpen(true)}
              className="btn-secondary h-12 w-full shrink-0 md:w-auto"
              aria-label="Open barcode scanner"
            >
              <ScanLine className="w-5 h-5" />
              <span className="md:hidden text-xs font-bold">Scan</span>
            </button>
          </div>
        )}

        <div className="flex-1 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col relative shadow-sm">
          {/* Cart Header */}
          <div className="px-5 py-4 border-b border-slate-100 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between relative">
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-black text-slate-900 tracking-tight leading-none">
                {mode === 'sales' ? 'Loss Logging' : 'Shortage Report'}
              </h2>
              <p className="text-xs font-medium text-slate-400 mt-1.5">
                {mode === 'sales' ? 'Documenting Gaps' : 'Inventory Audit'}
              </p>
            </div>

            {/* Mode Switcher */}
            <div className="order-3 w-full justify-center overflow-x-auto lg:order-none lg:w-auto xl:absolute xl:left-1/2 xl:-translate-x-1/2 tab-nav">
              {salesPerm !== 'none' && (
                <button
                  onClick={() => switchMode('sales')}
                  className={`tab-item ${mode === 'sales' ? 'tab-item-brand' : ''}`}
                >
                  Lost Sales
                </button>
              )}
              {shortagesPerm !== 'none' && (
                <button
                  onClick={() => switchMode('shortages')}
                  className={`tab-item ${mode === 'shortages' ? 'tab-item-active' : ''}`}
                >
                  Shortage
                </button>
              )}
            </div>

            {/* Status */}
            <div className="flex-1 flex justify-end">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-emerald-50 rounded-lg border border-emerald-100">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider">Active</span>
              </div>
            </div>
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto p-5 space-y-3 custom-scrollbar">
            {cart.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <Package size={32} strokeWidth={1.5} />
                </div>
                <p className="empty-state-title">Cart Empty</p>
                <p className="empty-state-desc">Scan or search for products to begin</p>
              </div>
            ) : (
              cart.map((item, idx) => (
                <div key={idx} className="group flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-brand/30">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-3.5 w-full sm:w-auto">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${mode === 'sales' ? 'bg-orange-50 text-orange-500 border border-orange-100' : 'bg-red-50 text-red-500 border border-red-100'}`}>
                        <Package size={20} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-black text-slate-900 tracking-tight uppercase text-sm leading-tight line-clamp-2">{item.productName}</h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider flex items-center gap-1">
                            <Hash size={9} strokeWidth={3} />
                            <span>{item.internalCode || 'NO CODE'}</span>
                          </p>
                          <span className="w-1 h-1 rounded-full bg-slate-200"></span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider truncate">{item.agentName || 'NO AGENT'}</span>
                        </div>
                      </div>
                    </div>

                    {mode === 'sales' ? (
                      <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
                        {/* Marks */}
                        <div className="flex items-center gap-1 rounded-lg border border-slate-100 bg-slate-50 p-1">
                          <button
                            onClick={() => toggleAlternative(idx)}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-tight transition-all border ${item.alternativeGiven ? 'bg-orange-50 border-orange-200 text-orange-600' : 'bg-transparent border-transparent text-slate-400 hover:text-slate-600'}`}
                            title="Alternative Suggested"
                          >
                            <Sparkles size={11} />
                            <span>Alt</span>
                          </button>
                          <button
                            onClick={() => toggleTransfer(idx)}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-tight transition-all border ${item.internalTransfer ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-transparent border-transparent text-slate-400 hover:text-slate-600'}`}
                            title="Internal Transfer Initiated"
                          >
                            <RefreshCcw size={11} />
                            <span>Transfer</span>
                          </button>
                        </div>

                        <div className="flex flex-col items-center">
                          <span className="text-[8px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Price</span>
                          <div className="flex items-center bg-slate-50 border border-slate-100 rounded-xl px-2.5 py-1.5">
                            <span className="text-[9px] font-bold text-slate-400 mr-1.5">BHD</span>
                            <input
                              type="number"
                              value={item.unitPrice}
                              onChange={(e) => updatePrice(idx, parseFloat(e.target.value) || 0)}
                              className="w-20 bg-transparent text-sm font-black text-slate-800 outline-none"
                              title="Unit price in BHD"
                              aria-label="Unit price"
                            />
                          </div>
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-[8px] font-bold text-slate-400 mb-1 uppercase tracking-wider">Qty</span>
                          <div className="flex items-center bg-slate-900 rounded-xl overflow-hidden">
                            <button onClick={() => updateQty(idx, item.quantity - 1)} className="p-2 text-white/40 hover:text-white hover:bg-white/10 transition-colors" aria-label="Decrease quantity"><Minus size={13} /></button>
                            <span className="w-8 text-center text-xs font-black text-white tabular-nums">{item.quantity}</span>
                            <button onClick={() => updateQty(idx, item.quantity + 1)} className="p-2 text-white/40 hover:text-white hover:bg-white/10 transition-colors" aria-label="Increase quantity"><Plus size={13} /></button>
                          </div>
                        </div>

                        <button onClick={() => removeItem(idx)} className="p-2.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" aria-label="Remove item from cart"><Trash2 size={18} /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                        <div className="flex items-center gap-1 rounded-lg border border-slate-100 bg-slate-50 p-1">
                          <button
                            onClick={() => updateStatus(idx, 'Low')}
                            className={`px-3.5 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all ${item.status === 'Low' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                          >
                            Low
                          </button>
                          <button
                            onClick={() => updateStatus(idx, 'Critical')}
                            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all ${item.status === 'Critical' ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                          >
                            <AlertTriangle size={11} />
                            <span>Critical</span>
                          </button>
                          <button
                            onClick={() => updateStatus(idx, 'Out of Stock')}
                            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all ${item.status === 'Out of Stock' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                          >
                            <Box size={11} />
                            <span>OOS</span>
                          </button>
                        </div>
                        <button onClick={() => removeItem(idx)} className="p-2.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" aria-label="Remove item from cart"><Trash2 size={18} /></button>
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  <div className="flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                    <FileText size={13} className="text-slate-300 mt-0.5 shrink-0" />
                    <textarea
                      placeholder="Add a remark or note for the warehouse/audit..."
                      value={item.notes || ''}
                      onChange={(e) => updateNotes(idx, e.target.value)}
                      className="w-full bg-transparent text-xs font-medium text-slate-600 outline-none resize-none min-h-[36px] placeholder:text-slate-300 placeholder:italic"
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Success Banner */}
          {showSuccess && (
            <div className="absolute inset-x-4 bottom-4 bg-slate-900 text-white p-4 rounded-xl flex items-center gap-4 shadow-xl z-50 ring-1 ring-white/10 animate-fade-in-up">
              <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center text-white shrink-0">
                <CheckCircle2 size={22} />
              </div>
              <div>
                <p className="font-black text-base tracking-tight">Successfully synced</p>
                <p className="text-white/50 text-xs font-medium mt-0.5">Inventory records updated in real time</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sidebar */}
      <div className="lg:col-span-4 flex flex-col gap-5">
        {/* Summary Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 md:p-6 flex-1 flex flex-col">
          <div className="flex-1 flex flex-col">
            <div className="min-h-[130px] flex flex-col items-center justify-center mb-6">
              {mode === 'sales' ? (
                <div className="text-center space-y-3">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">TOTAL LOSS ESTIMATE</p>
                  <div className="relative inline-block">
                    <p className="text-5xl font-black text-slate-900 tracking-tighter leading-none tabular-nums">{grandTotal.toFixed(3)}</p>
                    <p className="text-[9px] font-bold text-red-600 uppercase tracking-widest absolute -bottom-5 left-0 right-0">BAHRAINI DINARS</p>
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-3">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">ACTIVE REPORTING</p>
                  <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto border-2 border-slate-100">
                    <Target size={26} className="text-slate-300" />
                  </div>
                  <p className="text-base font-black text-slate-900 tracking-tight uppercase">Monitoring Gaps</p>
                </div>
              )}
            </div>

            <div className="space-y-2.5 border-t border-slate-100 pt-5">
              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Cart Items</span>
                <span className="px-2.5 py-0.5 bg-white rounded-lg text-xs font-black text-slate-900 shadow-sm border border-slate-100 tabular-nums">{cart.length}</span>
              </div>
              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Network</span>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span className="text-xs font-bold text-slate-900">Encrypted</span>
                </div>
              </div>
            </div>
          </div>

          {/* Finalize Button */}
          {(mode === 'sales' ? salesPerm === 'edit' : shortagesPerm === 'edit') ? (
            <button
            onClick={handleCheckout}
            disabled={cart.length === 0 || isSubmitting}
              className={`btn-primary mt-8 w-full py-3 text-sm md:text-base ${isSubmitting ? 'bg-slate-400 border-slate-400' : ''}`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin" size={22} />
                  <span>PROCESSING...</span>
                </>
              ) : (
                <>
                  <span>{mode === 'sales' ? 'LOG REVENUE LOSS' : 'FINALIZE REPORT'}</span>
                  <ChevronRight size={22} />
                </>
              )}
            </button>
          ) : (
            <div className="w-full bg-slate-50 text-slate-400 py-4 rounded-xl font-black text-xs border border-slate-100 flex items-center justify-center gap-3 mt-8">
              <AlertTriangle size={16} />
              <span>Read-Only Access</span>
            </div>
          )}
        </div>

        {/* Pharmacist Identity Card */}
        <div className="relative overflow-hidden rounded-lg border border-slate-800 bg-slate-900 p-6 md:p-7">
          <div className="relative z-10 text-center">
            <div className="w-16 h-16 bg-white/10 backdrop-blur-xl border border-white/10 rounded-xl flex items-center justify-center mx-auto mb-5 shadow-lg group-hover:scale-105 transition-all duration-300">
              <div className="w-11 h-11 bg-red-700 rounded-lg flex items-center justify-center text-white shadow-sm">
                <UserCircle size={36} strokeWidth={1.5} />
              </div>
            </div>
            <p className="text-xs font-bold text-red-400 mb-2">Certified pharmacist</p>
            <h3 className="font-black text-2xl text-white tracking-tighter mb-6 leading-tight">{pharmacist.name}</h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 p-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center">
                    <ShieldCheck size={15} />
                  </div>
                  <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">Branch</span>
                </div>
                <span className="text-xs font-black text-white">{branch.code}</span>
              </div>

              <button
                onClick={onBackToPharmacist}
                className="w-full flex items-center justify-center gap-2.5 p-3.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-white/50 hover:text-white transition-all border border-transparent hover:border-white/10 group"
              >
                <RefreshCcw size={14} className="group-hover:rotate-180 transition-transform duration-700" />
                <span>Switch Profile</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <ManualProductModal
        isOpen={isManualModalOpen}
        initialName={manualQuery}
        onClose={() => setIsManualModalOpen(false)}
        onSave={(data) => {
          const tempProduct = {
            id: `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: data.product_name,
            defaultPrice: Number(data.selling_price || 0),
            vatEnabled: false,
            vatRate: 0,
            agent: data.agent_name,
            category: data.category,
            isManual: true,
            createdByBranch: branch.id,
            internalCode: data.internal_code || undefined,
            internationalCode: undefined
          };
          addItem(tempProduct as any);
          setIsManualModalOpen(false);
        }}
      />
      {isScannerOpen && <BarcodeScanner onScan={handleScan} onClose={() => setIsScannerOpen(false)} />}

      {modeSwitchTarget && (
        <div className="fixed inset-0 z-[520] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="mode-switch-title"
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl"
          >
            <div className="border-b border-slate-100 p-5">
              <p id="mode-switch-title" className="text-sm font-black text-slate-950">Switch logging mode?</p>
              <p className="mt-1 text-sm font-medium text-slate-500">
                Switching to {modeSwitchTarget === 'sales' ? 'Lost Sales' : 'Shortage'} will clear the {cart.length} item{cart.length === 1 ? '' : 's'} currently in this draft.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 p-5">
              <button
                type="button"
                onClick={() => setModeSwitchTarget(null)}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 focus-ring"
              >
                Keep draft
              </button>
              <button
                type="button"
                onClick={confirmModeSwitch}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 focus-ring"
              >
                Clear and switch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toastMessage && (
        <div className={`fixed bottom-5 left-1/2 z-[500] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-xl border border-white/10 px-4 py-3 shadow-xl backdrop-blur-xl animate-fade-in-up ${toastMessage.type === 'error' ? 'bg-red-950 text-white' :
          toastMessage.type === 'success' ? 'bg-emerald-900 text-white' :
            'bg-slate-900 text-white'
          }`}>
          <div className={`w-2 h-2 rounded-full ${toastMessage.type === 'error' ? 'bg-red-400 animate-pulse' :
            toastMessage.type === 'success' ? 'bg-emerald-400 animate-pulse' :
              'bg-red-500 animate-pulse'
            }`}></div>
          <span className="text-sm font-bold">{toastMessage.message}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-4 text-white/40 hover:text-white transition-colors"
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
};
