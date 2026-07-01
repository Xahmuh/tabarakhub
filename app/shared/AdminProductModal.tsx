import React, { useState, useEffect } from 'react';
import { X, Check } from 'lucide-react';
import { Product } from '../../types';
import { BAHRAIN_VAT_RATE, getPriceIncludingVat } from '../../utils/vat';
import { formatBhdAmount } from '../../utils/money';

interface AdminProductModalProps {
    isOpen: boolean;
    product?: Product | null;
    onClose: () => void;
    onSave: (product: Partial<Product>) => Promise<void>;
}

export const AdminProductModal: React.FC<AdminProductModalProps> = ({ isOpen, product, onClose, onSave }) => {
    const [formData, setFormData] = useState<Partial<Product>>({
        name: '',
        category: '',
        agent: '',
        defaultPrice: 0,
        vatEnabled: false,
        vatRate: BAHRAIN_VAT_RATE,
        internalCode: '',
        isManual: true
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (product) {
                setFormData({
                    ...product,
                    isManual: product.isManual
                });
            } else {
                setFormData({
                    name: '',
                    category: '',
                    agent: '',
                    defaultPrice: 0,
                    vatEnabled: false,
                    vatRate: BAHRAIN_VAT_RATE,
                    internalCode: '',
                    isManual: true
                });
            }
            setError('');
        }
    }, [isOpen, product]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsSubmitting(true);
        try {
            await onSave(formData);
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to save product');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-product-modal-title"
            aria-describedby="admin-product-modal-description"
        >
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <span id="admin-product-modal-description" className="sr-only">Form for adding or editing product details including code, price, and category.</span>
                {/* Header */}
                <div className="bg-slate-900 p-6 flex justify-between items-center text-white">
                    <h2 id="admin-product-modal-title" className="text-xl font-bold">{product ? 'Edit Product' : 'Add New Product'}</h2>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-8 overflow-y-auto">
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-medium">
                            {error}
                        </div>
                    )}

                    <form id="product-form" onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Internal Code</label>
                                <input
                                    type="text"
                                    required
                                    disabled={!!product} // Read-only if editing
                                    value={formData.internalCode || ''}
                                    onChange={e => setFormData(prev => ({ ...prev, internalCode: e.target.value }))}
                                    className={`w-full p-3 rounded-xl border-2 font-mono ${product ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-white border-slate-200 focus:border-blue-500'} outline-none transition-all`}
                                    placeholder="e.g. 100200"
                                />
                                {product && <p className="text-xs text-slate-400">Internal Code cannot be changed once created.</p>}
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Price Ex. VAT</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">BHD</span>
                                    <input
                                        type="number"
                                        required
                                        step="0.001"
                                        value={formData.defaultPrice}
                                        onChange={e => setFormData(prev => ({ ...prev, defaultPrice: parseFloat(e.target.value) || 0 }))}
                                        className="w-full pl-16 p-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 outline-none transition-all font-mono"
                                    />
                                </div>
                                <p className="text-xs text-slate-400">
                                    Inc. VAT: {formatBhdAmount(getPriceIncludingVat(Number(formData.defaultPrice || 0), !!formData.vatEnabled, formData.vatRate))} BHD
                                </p>
                            </div>

                            <div className="col-span-1 md:col-span-2 space-y-2">
                                <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Product Name</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name || ''}
                                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value.toUpperCase() }))}
                                    className="w-full p-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 outline-none transition-all uppercase"
                                    placeholder="e.g. PANADOL EXTRA"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Category</label>
                                <input
                                    type="text"
                                    value={formData.category || ''}
                                    onChange={e => setFormData(prev => ({ ...prev, category: e.target.value }))}
                                    className="w-full p-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 outline-none transition-all"
                                    placeholder="e.g. Painkiller"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">Agent</label>
                                <input
                                    type="text"
                                    value={formData.agent || ''}
                                    onChange={e => setFormData(prev => ({ ...prev, agent: e.target.value.toUpperCase() }))}
                                    className="w-full p-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 outline-none transition-all uppercase"
                                    placeholder="e.g. INTERCOL"
                                />
                            </div>

                            <div className="col-span-1 md:col-span-2 space-y-2">
                                <label className="text-sm font-bold text-slate-700 uppercase tracking-wider">VAT</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, vatEnabled: true, vatRate: BAHRAIN_VAT_RATE }))}
                                        className={`p-4 rounded-xl border-2 text-left transition-all ${formData.vatEnabled ? 'border-red-700 bg-red-50 text-red-800' : 'border-slate-200 bg-white text-slate-600 hover:border-red-200'}`}
                                    >
                                        <span className="block text-sm font-black uppercase">YES</span>
                                        <span className="text-xs font-semibold">Apply Bahrain VAT ({Math.round(BAHRAIN_VAT_RATE * 100)}%)</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, vatEnabled: false, vatRate: BAHRAIN_VAT_RATE }))}
                                        className={`p-4 rounded-xl border-2 text-left transition-all ${!formData.vatEnabled ? 'border-slate-900 bg-slate-50 text-slate-900' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
                                    >
                                        <span className="block text-sm font-black uppercase">NO</span>
                                        <span className="text-xs font-semibold">0% VAT for this item</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-slate-100">
                            <div className="flex items-center space-x-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                                <input
                                    type="checkbox"
                                    disabled={false /* Is manual is editable? Spec says 'Manual creation/edit respects checkbox'. */}
                                    id="is_manual"
                                    checked={formData.isManual}
                                    onChange={e => setFormData(prev => ({ ...prev, isManual: e.target.checked }))}
                                    className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                                />
                                <label htmlFor="is_manual" className="text-sm font-bold text-slate-700 cursor-pointer select-none">
                                    Mark as Manual Product
                                    <p className="text-xs text-slate-400 font-normal mt-0.5">If unchecked, this product may be overwritten by system syncs differently (logic dependent).</p>
                                </label>
                            </div>
                        </div>
                    </form>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-6 py-3 font-bold text-slate-500 hover:text-slate-800 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="product-form"
                        disabled={isSubmitting}
                        className="px-8 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
                    >
                        {isSubmitting ? <span className="animate-spin">...</span> : <Check size={20} />}
                        <span>{product ? 'Update Product' : 'Create Product'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
