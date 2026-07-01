import React, { useState, useRef, useEffect } from 'react';
import { Download, Upload, Plus, Search, FileSpreadsheet, AlertCircle, CheckCircle, ShieldCheck, Database } from 'lucide-react';
import { productService } from '../../services/productService';
import type { ProductBulkUploadProgress } from '../../services/productService';
import { generateProductTemplate, generateProductListExport, parseProductUpload, PRODUCT_IMPORT_ACCEPT, isSupportedProductImportFile } from '../../utils/excelUtils';
import { AdminProductModal } from './AdminProductModal';
import { Product } from '../../types';
import Swal from 'sweetalert2';
import { isModuleEnabled } from '../../config/clientConfig';
import { formatVatLabel, getPriceIncludingVat } from '../../utils/vat';
import { formatBhdAmount } from '../../utils/money';

const escapeUploadHtml = (value: string) => value.replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
}[char] || char));

const renderUploadProgressHtml = (percent: number, label: string, detail?: string) => {
    const safePercent = Math.max(0, Math.min(100, Math.round(percent)));
    return `
        <div style="font-family: inherit; text-align: left;">
            <p style="margin: 0 0 8px; font-size: 12px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; color: #94a3b8;">Parsing and uploading products</p>
            <div style="display: flex; justify-content: space-between; gap: 12px; align-items: center; margin-bottom: 10px;">
                <span style="font-size: 13px; font-weight: 800; color: #334155;">${escapeUploadHtml(label)}</span>
                <span style="font-size: 18px; font-weight: 900; color: #b91c1c;">${safePercent}%</span>
            </div>
            <div style="height: 10px; border-radius: 999px; background: #e2e8f0; overflow: hidden;">
                <div style="height: 100%; width: ${safePercent}%; border-radius: 999px; background: linear-gradient(90deg, #991b1b, #ef4444); transition: width 180ms ease;"></div>
            </div>
            ${detail ? `<p style="margin: 10px 0 0; font-size: 12px; font-weight: 700; color: #64748b;">${escapeUploadHtml(detail)}</p>` : ''}
        </div>
    `;
};

const mapBulkUploadProgress = (progress: ProductBulkUploadProgress) => {
    const ratio = progress.totalSteps > 0 ? progress.completedSteps / progress.totalSteps : 1;
    const percent = progress.stage === 'complete' ? 96 : 38 + Math.round(ratio * 56);
    const label = progress.stage === 'checking'
        ? 'Checking existing products'
        : progress.stage === 'uploading'
            ? 'Uploading products'
            : 'Finalizing upload';
    const detail = `${progress.processedRows.toLocaleString()} of ${progress.totalRows.toLocaleString()} product rows processed`;
    return { percent, label, detail };
};

export const ProductManagementSection: React.FC = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [uploadStats, setUploadStats] = useState<{
        inserted: number;
        updated: number;
        failed: number;
        errors: { row: number; message: string }[];
    } | null>(null);

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const data = await productService.getProductsForExport();
            setProducts(data);
        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'Failed to fetch products', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProducts();
    }, []);

    const handleDownloadTemplate = async () => {
        try {
            await generateProductTemplate();
        } catch (error) {
            Swal.fire('Error', 'Failed to generate template', 'error');
        }
    };

    const handleDownloadList = async () => {
        try {
            let exportRows = products;
            if (exportRows.length === 0) {
                exportRows = await productService.getProductsForExport();
                setProducts(exportRows);
            }
            await generateProductListExport(exportRows);
        } catch (error) {
            Swal.fire('Error', 'Failed to export list', 'error');
        }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        // Reset previous stats
        setUploadStats(null);

        // Basic validation
        if (!isSupportedProductImportFile(file)) {
            Swal.fire('Invalid File', 'Please upload a .xlsx Excel or .csv file.', 'warning');
            return;
        }

        const updateUploadProgress = (percent: number, label: string, detail?: string) => {
            Swal.update({
                html: renderUploadProgressHtml(percent, label, detail)
            });
        };

        Swal.fire({
            title: 'Processing...',
            html: renderUploadProgressHtml(3, 'Preparing product upload', file.name),
            allowOutsideClick: false,
            allowEscapeKey: false,
            showConfirmButton: false
        });

        try {
            // 1. Parse
            const { validRows, errors: parseErrors } = await parseProductUpload(file, progress => {
                updateUploadProgress(progress.percent, progress.label, progress.detail);
            });

            if (parseErrors.length > 0 && validRows.length === 0) {
                // All failed parsing
                Swal.close();
                setUploadStats({
                    inserted: 0,
                    updated: 0,
                    failed: parseErrors.length,
                    errors: parseErrors
                });
                return;
            }

            // 2. Upsert
            updateUploadProgress(36, 'Preparing database upload', `${validRows.length.toLocaleString()} valid rows ready`);
            const { inserted, updated, failed } = await productService.bulkUpsertProducts(validRows, {
                onProgress: progress => {
                    const mapped = mapBulkUploadProgress(progress);
                    updateUploadProgress(mapped.percent, mapped.label, mapped.detail);
                }
            });

            updateUploadProgress(98, 'Refreshing product list', 'Syncing latest catalog view');
            setUploadStats({
                inserted,
                updated,
                failed: failed + parseErrors.length, // Add parsing errors to failed count
                errors: parseErrors // Show parsing errors as reasons
            });

            // Refresh list
            await fetchProducts();

            updateUploadProgress(100, 'Upload complete', `${inserted.toLocaleString()} inserted | ${updated.toLocaleString()} updated | ${(failed + parseErrors.length).toLocaleString()} failed`);
            setTimeout(() => Swal.close(), 350);

            if (fileInputRef.current) fileInputRef.current.value = '';

        } catch (error: any) {
            Swal.close();
            Swal.fire('Upload Failed', error.message || 'Unknown error occurred', 'error');
        }
    };

    const handleSaveProduct = async (productData: Partial<Product>) => {
        try {
            if (editingProduct) {
                await productService.updateProduct(editingProduct.id, productData);
                Swal.fire('Success', 'Product updated successfully', 'success');
            } else {
                await productService.createProduct(productData);
                Swal.fire('Success', 'Product created successfully', 'success');
            }
            fetchProducts();
        } catch (error: any) {
            throw error; // Let modal handle error display
        }
    };

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.internalCode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 50;
    const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
    const excelWorkflowsEnabled = isModuleEnabled('excelExport');
    const bulkImportEnabled = excelWorkflowsEnabled;

    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
    const paginatedProducts = filteredProducts.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // Reset page when search changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery]);

    const toggleSelectAll = () => {
        if (selectedProductIds.size === filteredProducts.length) {
            setSelectedProductIds(new Set());
        } else {
            setSelectedProductIds(new Set(filteredProducts.map(p => p.id)));
        }
    };

    const toggleSelectProduct = (id: string) => {
        const newSet = new Set(selectedProductIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedProductIds(newSet);
    };

    const handleDownloadSelected = async () => {
        const selected = products.filter(p => selectedProductIds.has(p.id));
        if (selected.length === 0) return;
        try {
            await generateProductListExport(selected);
        } catch (error) {
            Swal.fire('Error', 'Failed to export selected items', 'error');
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header & Stats */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Product Management</h2>
                    <p className="text-slate-500 font-medium mt-1">Manage global product catalog, pricing, and bulk imports.</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="px-4 py-2 bg-slate-100 rounded-lg text-slate-600 font-mono text-sm font-bold">
                        {products.length} Total Products
                    </div>
                    {selectedProductIds.size > 0 && (
                        <div className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg font-mono text-sm font-bold animate-in zoom-in">
                            {selectedProductIds.size} Selected
                        </div>
                    )}
                </div>
            </div>

            {/* Bulk Import */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-red-50 text-red-700 flex items-center justify-center shrink-0">
                            <Upload size={20} />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">Bulk Product Upload</h3>
                            <p className="text-xs text-slate-500 font-medium mt-1">
                                Upload `.xlsx` or `.csv` files using the official template headers. Existing `internal_code` rows update; new codes insert.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {bulkImportEnabled && (
                            <button
                                onClick={handleDownloadTemplate}
                                className="btn-secondary"
                            >
                                <FileSpreadsheet className="w-4 h-4" />
                                <span>Template</span>
                            </button>
                        )}

                        {bulkImportEnabled && (
                        <>
                            <input
                                type="file"
                                ref={fileInputRef}
                                accept={PRODUCT_IMPORT_ACCEPT}
                                className="hidden"
                                onChange={handleFileUpload}
                            />
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="btn-primary"
                            >
                                <Upload className="w-4 h-4" />
                                <span>Bulk Import</span>
                            </button>
                        </>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100 bg-slate-50/60">
                    <div className="p-4 flex items-start gap-3">
                        <ShieldCheck className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                        <div>
                            <p className="text-xs font-black text-slate-700">Trusted manager workflow</p>
                            <p className="text-[11px] text-slate-500 mt-0.5">Excel and CSV import is kept inside Product Management only.</p>
                        </div>
                    </div>
                    <div className="p-4 flex items-start gap-3">
                        <Database className="w-4 h-4 text-red-700 mt-0.5 shrink-0" />
                        <div>
                            <p className="text-xs font-black text-slate-700">Upsert by internal code</p>
                            <p className="text-[11px] text-slate-500 mt-0.5">Same-code rows update the existing product; latest row in the file wins.</p>
                        </div>
                    </div>
                    <div className="p-4 flex items-start gap-3">
                        <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                        <div>
                            <p className="text-xs font-black text-slate-700">5MB maximum file size</p>
                            <p className="text-[11px] text-slate-500 mt-0.5">CSV/XLSX headers: internal_code, name, category, agent, retail price ex vat, vat, is_manual.</p>
                        </div>
                    </div>
                </div>

                {!bulkImportEnabled && (
                    <div className="p-4 bg-amber-50 border-t border-amber-100 text-sm font-semibold text-amber-800">
                        Bulk import is disabled by `VITE_MODULE_EXCEL_EXPORT`. Enable it for trusted manager/admin deployments.
                    </div>
                )}
            </div>

            {/* Actions Toolbar */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-wrap gap-4 items-center justify-between">
                <div className="flex flex-wrap gap-3">
                    {excelWorkflowsEnabled && (selectedProductIds.size > 0 ? (
                        <button
                            onClick={handleDownloadSelected}
                            className="btn-primary"
                        >
                            <Download className="w-4 h-4" />
                            <span>Export Selected ({selectedProductIds.size})</span>
                        </button>
                    ) : (
                        <button
                            onClick={handleDownloadList}
                            className="btn-secondary"
                        >
                            <Download className="w-4 h-4" />
                            <span>Export Full Database ({products.length})</span>
                        </button>
                    ))}
                </div>

                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={() => { setEditingProduct(null); setIsModalOpen(true); }}
                        className="btn-primary"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Add Product</span>
                    </button>
                </div>
            </div>

            {/* Upload Results Summary */}
            {uploadStats && (
                <div className={`p-5 rounded-xl border ${uploadStats.failed > 0 ? 'bg-orange-50 border-orange-100' : 'bg-green-50 border-green-100'}`}>
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                        {uploadStats.failed > 0 ? <AlertCircle className="text-orange-600" /> : <CheckCircle className="text-green-600" />}
                        <span className={uploadStats.failed > 0 ? 'text-orange-900' : 'text-green-900'}>Last Upload Summary</span>
                    </h3>
                    <div className="grid grid-cols-3 gap-4 mb-4">
                        <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-100 flex flex-col items-center">
                            <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Inserted</span>
                            <span className="text-2xl font-black text-green-600">{uploadStats.inserted}</span>
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-100 flex flex-col items-center">
                            <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Updated</span>
                            <span className="text-2xl font-black text-blue-600">{uploadStats.updated}</span>
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-100 flex flex-col items-center">
                            <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Failed</span>
                            <span className={`text-2xl font-black ${uploadStats.failed > 0 ? 'text-red-600' : 'text-slate-300'}`}>{uploadStats.failed}</span>
                        </div>
                    </div>

                    {uploadStats.errors.length > 0 && (
                        <div className="bg-white rounded-xl border border-orange-200 overflow-hidden">
                            <div className="p-3 bg-orange-100 font-bold text-orange-800 text-sm border-b border-orange-200">
                                Failure Details
                            </div>
                            <div className="max-h-48 overflow-y-auto p-4 space-y-2">
                                {uploadStats.errors.map((err, idx) => (
                                    <div key={idx} className="flex gap-2 text-sm text-slate-600">
                                        <span className="font-mono font-bold text-orange-600">Row {err.row}:</span>
                                        <span>{err.message}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Product List */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[600px]">
                <div className="p-4 border-b border-slate-100 flex gap-4 items-center bg-slate-50/50">
                    <Search className="text-slate-400" size={20} />
                    <input
                        className="bg-transparent outline-none w-full font-medium text-slate-600 placeholder:text-slate-400"
                        placeholder="Search products by Name, Code, or Category..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="flex-1 overflow-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 text-slate-500 font-semibold text-sm sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="p-4 pl-6 w-12">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                                        checked={filteredProducts.length > 0 && selectedProductIds.size === filteredProducts.length}
                                        onChange={toggleSelectAll}
                                    />
                                </th>
                                <th className="p-4 w-32">Code</th>
                                <th className="p-4">Product Name</th>
                                <th className="p-4">Category</th>
                                <th className="p-4">Agent</th>
                                <th className="p-4 text-right">Price Ex. VAT</th>
                                <th className="p-4 text-center">VAT</th>
                                <th className="p-4 text-right">Price Inc. VAT</th>
                                <th className="p-4 text-center">Is Manual</th>
                                <th className="p-4 text-right pr-6">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan={10} className="p-8 text-center text-slate-400 italic">Loading products...</td></tr>
                            ) : filteredProducts.length === 0 ? (
                                <tr><td colSpan={10} className="p-8 text-center text-slate-400 italic">No products found.</td></tr>
                            ) : paginatedProducts.map((product) => (
                                <tr key={product.id} className={`hover:bg-slate-50 transition-colors group ${selectedProductIds.has(product.id) ? 'bg-blue-50/50' : ''}`}>
                                    <td className="p-4 pl-6">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                                            checked={selectedProductIds.has(product.id)}
                                            onChange={() => toggleSelectProduct(product.id)}
                                        />
                                    </td>
                                    <td className="p-4 font-mono text-xs font-bold text-slate-500">{product.internalCode}</td>
                                    <td className="p-4 font-bold text-slate-700">{product.name}</td>
                                    <td className="p-4 text-sm text-slate-600">
                                        {product.category && <span className="px-2 py-1 bg-slate-100 rounded-md">{product.category}</span>}
                                    </td>
                                    <td className="p-4 text-sm text-slate-600">{product.agent}</td>
                                    <td className="p-4 text-right font-mono font-bold text-slate-800">{formatBhdAmount(product.defaultPrice)} BHD</td>
                                    <td className="p-4 text-center">
                                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${product.vatEnabled ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                                            {formatVatLabel(product.vatEnabled, product.vatRate)}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right font-mono font-bold text-slate-600">
                                        {formatBhdAmount(getPriceIncludingVat(product.defaultPrice || 0, product.vatEnabled, product.vatRate))} BHD
                                    </td>
                                    <td className="p-4 text-center">
                                        {product.isManual ? (
                                            <span className="inline-flex items-center justify-center w-6 h-6 bg-blue-100 text-blue-600 rounded-full">
                                                <CheckCircle size={14} />
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center justify-center w-6 h-6 bg-slate-100 text-slate-300 rounded-full">
                                                <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-4 text-right pr-6">
                                        <button
                                            onClick={() => { setEditingProduct(product); setIsModalOpen(true); }}
                                            className="px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 rounded-lg text-sm font-bold text-slate-600 shadow-sm transition-all"
                                        >
                                            Edit
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Footer */}
                <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                    <p className="text-sm text-slate-500 font-bold">
                        Showing {filteredProducts.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredProducts.length)} of {filteredProducts.length} items
                    </p>
                    <div className="flex gap-2">
                        <button
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-600 disabled:opacity-50 hover:bg-slate-100 transition-all"
                        >
                            Previous
                        </button>
                        <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                // Simple sliding window logic or just show first 5 for now 
                                // Proper pagination logic:
                                let p = currentPage - 2 + i;
                                if (currentPage < 3) p = i + 1;
                                if (currentPage > totalPages - 2) p = totalPages - 4 + i;
                                if (totalPages < 5) p = i + 1; // fallback if total pages < 5

                                if (p > 0 && p <= totalPages) {
                                    return (
                                        <button
                                            key={p}
                                            onClick={() => setCurrentPage(p)}
                                            className={`w-8 h-8 rounded-lg text-sm font-bold transition-all ${currentPage === p ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                                        >
                                            {p}
                                        </button>
                                    );
                                }
                                return null;
                            })}
                        </div>
                        <button
                            disabled={currentPage === totalPages || totalPages === 0}
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-600 disabled:opacity-50 hover:bg-slate-100 transition-all"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>

            <AdminProductModal
                isOpen={isModalOpen}
                product={editingProduct}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSaveProduct}
            />
        </div>
    );
};
