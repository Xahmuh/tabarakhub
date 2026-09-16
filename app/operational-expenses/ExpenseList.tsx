import React, { useEffect, useState, useMemo } from 'react';
import { Building2, Calendar, Check, Edit3, FileSpreadsheet, FileText, Filter, Fuel, Package, Plus, Receipt, RotateCcw, Search, Tag, Trash2, Wrench, X } from 'lucide-react';
import { Branch, ExpenseCategory, ExpenseFilters, ExpenseTransaction } from '../../types';
import { expenseService } from '../../services/expenseService';
import { branchService } from '../../services/branchService';
import { formatBhdWithCurrency } from '../../utils/money';
import { exportExpensesToExcel } from './utils/exportExpenses';
import { PaginationControls } from '../shared';

const PAGE_SIZE = 50;

interface ExpenseListProps {
  user: Branch;
  isManager: boolean;
  canEdit: boolean;
  onEdit: (id: string) => void;
  onNewExpense: () => void;
}

export const ExpenseList: React.FC<ExpenseListProps> = ({ user, isManager, canEdit, onEdit, onNewExpense }) => {
  const [expenses, setExpenses] = useState<ExpenseTransaction[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState<string>(isManager ? 'all' : user.id);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [receiptFilter, setReceiptFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedExpense, setSelectedExpense] = useState<ExpenseTransaction | null>(null);
  
  // Action confirmations
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Privileged user roles bypass the 48-hour deletion lock (Admin, Manager, Accounts/Finance)
  const isPrivilegedUser = useMemo(() => {
    return isManager || ['owner', 'admin', 'manager', 'accounts'].includes(user?.role);
  }, [isManager, user?.role]);

  // Check if expense deletion is allowed (allowed within 48 hours for regular branch users, unlimited for privileged roles)
  const canDeleteExpense = (exp: ExpenseTransaction): boolean => {
    if (isPrivilegedUser) return true;
    if (!exp.createdAt) return true;
    const createdTime = new Date(exp.createdAt).getTime();
    const now = Date.now();
    const hoursSinceCreation = (now - createdTime) / (1000 * 60 * 60);
    return hoursSinceCreation <= 48;
  };

  const filters: ExpenseFilters = useMemo(() => ({
    branchId: isManager ? selectedBranch : user.id,
    categoryId: selectedCategory,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined
  }), [isManager, selectedBranch, user.id, selectedCategory, dateFrom, dateTo]);

  useEffect(() => {
    expenseService.categories.list().then(setCategories).catch(console.error);
    if (isManager) branchService.list().then(setBranches).catch(console.error);
  }, [isManager]);

  useEffect(() => {
    setLoading(true);
    expenseService.expenses.list(filters)
      .then(setExpenses)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filters]);

  useEffect(() => {
    setCurrentPage(1);
  }, [receiptFilter, searchTerm, selectedBranch, selectedCategory, dateFrom, dateTo]);

  const isFilterActive = useMemo(() => {
    return (
      (isManager && selectedBranch !== 'all') ||
      selectedCategory !== 'all' ||
      dateFrom !== '' ||
      dateTo !== '' ||
      receiptFilter !== 'all' ||
      searchTerm !== ''
    );
  }, [isManager, selectedBranch, selectedCategory, dateFrom, dateTo, receiptFilter, searchTerm]);

  const handleResetFilters = () => {
    if (isManager) setSelectedBranch('all');
    setSelectedCategory('all');
    setDateFrom('');
    setDateTo('');
    setReceiptFilter('all');
    setSearchTerm('');
  };

  const filteredExpenses = useMemo(() => {
    let result = expenses;
    if (receiptFilter === 'pending') result = result.filter(e => !e.receiptProvidedToAccounts);
    if (receiptFilter === 'provided') result = result.filter(e => e.receiptProvidedToAccounts);

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(e =>
        e.referenceNo.toLowerCase().includes(term) ||
        (e.plateNumber || '').toLowerCase().includes(term) ||
        (e.vehicleCode || '').toLowerCase().includes(term) ||
        (e.driverName || '').toLowerCase().includes(term) ||
        (e.createdBy || '').toLowerCase().includes(term) ||
        (e.categoryName || '').toLowerCase().includes(term) ||
        (e.description || '').toLowerCase().includes(term) ||
        (e.paidTo || '').toLowerCase().includes(term) ||
        (e.branchCode || '').toLowerCase().includes(term) ||
        (e.branchName || '').toLowerCase().includes(term) ||
        e.amount.toString().includes(term)
      );
    }
    return result;
  }, [expenses, receiptFilter, searchTerm]);

  const paginatedExpenses = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return filteredExpenses.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredExpenses, currentPage]);

  const handleDeleteExpense = async (id: string) => {
    const target = expenses.find(e => e.id === id);
    if (target && !canDeleteExpense(target)) {
      alert('Deletion is restricted after 48 hours for branch accounts. Only Admin, Manager, or Finance accounts can delete older records.');
      setDeleteConfirmId(null);
      return;
    }

    setActionLoadingId(id);
    try {
      await expenseService.expenses.delete(id);
      setExpenses(prev => prev.filter(e => e.id !== id));
      if (selectedExpense?.id === id) setSelectedExpense(null);
      setDeleteConfirmId(null);
    } catch (e: any) {
      alert(e.message || 'Unable to delete expense.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleToggleReceipt = async (id: string, provided: boolean) => {
    try {
      const updated = await expenseService.expenses.toggleReceiptProvided(id, provided);
      setExpenses(prev => prev.map(e => e.id === id ? updated : e));
      if (selectedExpense?.id === id) setSelectedExpense(updated);
    } catch (e: any) {
      alert(e.message || 'Unable to update receipt status.');
    }
  };

  const categoryIcon = (slug?: string) => {
    switch (slug) {
      case 'fuel': return <Fuel className="h-3.5 w-3.5 text-slate-600" />;
      case 'vehicle_services': return <Wrench className="h-3.5 w-3.5 text-slate-600" />;
      case 'maintenance': return <Building2 className="h-3.5 w-3.5 text-slate-600" />;
      case 'supplies': return <Package className="h-3.5 w-3.5 text-slate-600" />;
      default: return <FileText className="h-3.5 w-3.5 text-slate-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Upgraded Modern Filter Bar & Control Panel */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 md:p-5 space-y-4">
        {/* Panel Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-brand/10 text-brand rounded-xl">
              <Filter className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Search & Filters</h3>
              <p className="text-[11px] font-bold text-slate-400">
                Showing <span className="text-brand font-black">{filteredExpenses.length}</span> recorded expenses
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isFilterActive && (
              <button
                onClick={handleResetFilters}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-colors"
                title="Reset all filters"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </button>
            )}
            <button
              onClick={() => exportExpensesToExcel(filteredExpenses, `Expenses_List_${user.code}`)}
              disabled={filteredExpenses.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 shadow-sm"
              title="Export filtered expenses to Excel"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Export Excel
            </button>
            {canEdit && (
              <button onClick={onNewExpense}
                className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm hover:bg-brand-hover transition-all">
                <Plus className="h-4 w-4" /> New Expense
              </button>
            )}
          </div>
        </div>

        {/* Filter Controls Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Branch Filter */}
          {isManager && branches.length > 0 ? (
            <div>
              <label className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                <Building2 className="h-3 w-3 text-slate-400" /> Branch
              </label>
              <select
                value={selectedBranch}
                onChange={e => setSelectedBranch(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none transition-all"
              >
                <option value="all">All Branches</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.code} ({b.name})</option>)}
              </select>
            </div>
          ) : null}

          {/* Category Filter */}
          <div>
            <label className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
              <Tag className="h-3 w-3 text-slate-400" /> Category
            </label>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none transition-all"
            >
              <option value="all">All Categories</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* From Date */}
          <div>
            <label className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
              <Calendar className="h-3 w-3 text-slate-400" /> From
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none transition-all"
            />
          </div>

          {/* To Date */}
          <div>
            <label className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
              <Calendar className="h-3 w-3 text-slate-400" /> To
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none transition-all"
            />
          </div>

          {/* Receipt Status Filter */}
          <div>
            <label className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
              <Receipt className="h-3 w-3 text-slate-400" /> Receipt
            </label>
            <select
              value={receiptFilter}
              onChange={e => setReceiptFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-brand focus:ring-2 focus:ring-brand/20 focus:outline-none transition-all"
            >
              <option value="all">All Receipts</option>
              <option value="pending">Pending Receipt</option>
              <option value="provided">Receipt Provided</option>
            </select>
          </div>
        </div>

        {/* Modernized UI Search Cell */}
        <div className="relative group pt-1">
          <div className="relative flex items-center">
            <div className="absolute left-3.5 flex items-center justify-center text-slate-400 group-focus-within:text-brand transition-colors">
              <Search className="h-4.5 w-4.5" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search by plate number, reference no, category, driver, pharmacist, description, amount..."
              className="w-full pl-11 pr-24 py-3 rounded-2xl border border-slate-200 bg-slate-50/70 text-xs font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-medium focus:bg-white focus:border-brand focus:ring-4 focus:ring-brand/10 focus:outline-none transition-all shadow-sm hover:border-slate-300"
            />
            {searchTerm ? (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[11px] font-bold transition-all shadow-xs"
                title="Clear search"
              >
                <X className="h-3 w-3" /> Clear
              </button>
            ) : (
              <div className="absolute right-3 hidden sm:flex items-center gap-1 px-2 py-1 bg-slate-200/50 text-slate-400 rounded-lg text-[10px] font-bold tracking-wide pointer-events-none">
                <span>Quick Search</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        </div>
      ) : filteredExpenses.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
          <FileText className="h-12 w-12 text-slate-200 mx-auto mb-4" />
          <p className="text-sm font-bold text-slate-500">No expenses found matching active filters.</p>
          {isFilterActive && (
            <button
              onClick={handleResetFilters}
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Clear All Filters
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Ref No.</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Date</th>
                  {isManager && <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Branch</th>}
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Category</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Description</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Recorded By</th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Driver / Vehicle Plate</th>
                  <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Amount</th>
                  <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Receipt</th>
                  {canEdit && <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedExpenses.map(exp => {
                  const isDeletable = canDeleteExpense(exp);
                  return (
                    <tr key={exp.id}
                      className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 font-bold text-slate-900 whitespace-nowrap">
                        {exp.referenceNo}
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {new Date(exp.expenseDate + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      {isManager && <td className="px-4 py-3 text-slate-600">{exp.branchCode || '—'}</td>}
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          {categoryIcon(exp.categorySlug)}
                          <span className="font-bold text-slate-700">{exp.categoryName}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-[180px] truncate">{exp.description || '—'}</td>
                      <td className="px-4 py-3 text-slate-600 font-medium">{exp.createdBy || '—'}</td>
                      <td className="px-4 py-3 text-slate-600 text-xs font-semibold">
                        {exp.driverName || exp.plateNumber || exp.vehicleCode
                          ? `${exp.driverName || ''} ${exp.plateNumber ? `[Plate: ${exp.plateNumber}]` : exp.vehicleCode ? `(${exp.vehicleCode})` : ''}`
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-black text-brand whitespace-nowrap">
                        {formatBhdWithCurrency(exp.amount)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {exp.receiptProvidedToAccounts
                          ? <Check className="h-4 w-4 text-emerald-500 mx-auto" />
                          : <span className="text-slate-300">—</span>}
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Edit Button */}
                            <button
                              onClick={() => onEdit(exp.id)}
                              className="p-1.5 bg-slate-100 hover:bg-brand hover:text-white text-slate-600 rounded-md transition-colors"
                              title="Edit Expense"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>

                            {/* Delete Button / Confirm */}
                            {isDeletable ? (
                              deleteConfirmId === exp.id ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleDeleteExpense(exp.id)}
                                    disabled={actionLoadingId === exp.id}
                                    className="px-2 py-1 bg-red-600 text-white rounded text-[10px] font-bold hover:bg-red-700"
                                  >
                                    Confirm Delete
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirmId(null)}
                                    className="px-1.5 py-1 bg-slate-100 text-slate-500 rounded text-[10px]"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setDeleteConfirmId(exp.id)}
                                  className="p-1.5 bg-slate-100 hover:bg-red-600 hover:text-white text-red-600 rounded-md transition-colors"
                                  title="Delete Expense"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )
                            ) : (
                              <button
                                disabled
                                className="p-1.5 bg-slate-50 text-slate-300 cursor-not-allowed rounded-md"
                                title="Deletion locked: 48 hours passed since creation (Admin/Finance authorization required)"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="px-4 pb-4">
            <PaginationControls
              currentPage={currentPage}
              totalItems={filteredExpenses.length}
              pageSize={PAGE_SIZE}
              onPageChange={setCurrentPage}
              itemLabel="expenses"
            />
          </div>
        </div>
      )}

      {/* Expense Detail Drawer */}
      {selectedExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setSelectedExpense(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-black text-slate-900">Expense Details</h3>
              </div>
              <button onClick={() => setSelectedExpense(null)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>

            <div className="space-y-4">
              <DetailRow label="Reference" value={selectedExpense.referenceNo} />
              <DetailRow label="Branch" value={`${selectedExpense.branchCode || ''} — ${selectedExpense.branchName || ''}`} />
              <DetailRow label="Date" value={new Date(selectedExpense.expenseDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} />
              <DetailRow label="Time" value={selectedExpense.expenseTime || '—'} />
              <DetailRow label="Category" value={selectedExpense.categoryName || '—'} />
              {selectedExpense.categorySlug === 'fuel' && selectedExpense.fuelDetails && (
                <>
                  <DetailRow label="Vehicle Plate" value={selectedExpense.plateNumber ? `Plate: ${selectedExpense.plateNumber} ${selectedExpense.vehicleCode ? `(Code: ${selectedExpense.vehicleCode})` : ''}` : (selectedExpense.vehicleCode || '—')} />
                  <DetailRow label="Driver" value={selectedExpense.driverName || '—'} />
                  <DetailRow label="Last Odometer" value={`${selectedExpense.fuelDetails.previousOdometer.toLocaleString()} km`} />
                  <DetailRow label="Current Odometer" value={`${selectedExpense.fuelDetails.currentOdometer.toLocaleString()} km`} />
                  <DetailRow label="Distance" value={`${selectedExpense.fuelDetails.distanceSincePrevious.toLocaleString()} km`} />
                </>
              )}
              {selectedExpense.categorySlug !== 'fuel' && (
                <DetailRow label="Description" value={selectedExpense.description || '—'} />
              )}
              <DetailRow label="Amount" value={formatBhdWithCurrency(selectedExpense.amount)} highlight />
              {selectedExpense.receiptUrl && (
                <DetailRow label="Receipt" value={
                  <a href={selectedExpense.receiptUrl} target="_blank" rel="noreferrer" className="text-brand font-bold hover:underline">View Receipt</a>
                } />
              )}
              <div className="flex items-center justify-between py-2 border-b border-slate-50">
                <span className="text-xs font-black uppercase tracking-[0.15em] text-slate-400">Receipt Provided to Accounts</span>
                <button
                  onClick={() => handleToggleReceipt(selectedExpense.id, !selectedExpense.receiptProvidedToAccounts)}
                  className={`w-10 h-6 rounded-full transition-colors relative ${selectedExpense.receiptProvidedToAccounts ? 'bg-emerald-500' : 'bg-slate-200'}`}
                >
                  <span className={`block w-4 h-4 bg-white rounded-full shadow-sm absolute top-1 transition-transform ${selectedExpense.receiptProvidedToAccounts ? 'translate-x-5' : 'translate-x-1'}`} />
                </button>
              </div>
              <DetailRow label="Pharmacist / Recorded By" value={selectedExpense.createdBy || '—'} />
              <DetailRow label="Created At" value={selectedExpense.createdAt ? new Date(selectedExpense.createdAt).toLocaleString('en-GB') : '—'} />
            </div>

            {canEdit && (
              <div className="flex flex-wrap gap-2 mt-8 pt-6 border-t border-slate-100">
                <button onClick={() => { setSelectedExpense(null); onEdit(selectedExpense.id); }}
                  className="flex-1 px-4 py-2.5 bg-brand text-white rounded-lg text-xs font-black uppercase tracking-wider hover:bg-brand-hover transition-colors">
                  Edit Expense
                </button>

                {canDeleteExpense(selectedExpense) ? (
                  deleteConfirmId === selectedExpense.id ? (
                    <div className="flex gap-2 w-full mt-2">
                      <button onClick={() => handleDeleteExpense(selectedExpense.id)}
                        className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg text-xs font-black uppercase tracking-wider hover:bg-red-700 transition-colors">
                        Confirm Delete
                      </button>
                      <button onClick={() => setDeleteConfirmId(null)}
                        className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-black uppercase tracking-wider hover:bg-slate-200 transition-colors">
                        Back
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setDeleteConfirmId(selectedExpense.id)}
                      className="px-4 py-2.5 bg-slate-100 text-red-600 rounded-lg text-xs font-black uppercase tracking-wider hover:bg-red-50 transition-colors">
                      Delete Expense
                    </button>
                  )
                ) : (
                  <div className="w-full mt-2 p-3 bg-amber-50 rounded-xl text-[11px] font-bold text-amber-800 border border-amber-200 text-center">
                    Deletion locked: More than 48 hours have passed since creation. Requires Admin, Manager, or Accounts permission.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const DetailRow: React.FC<{ label: string; value: React.ReactNode; highlight?: boolean }> = ({ label, value, highlight }) => (
  <div className="flex items-start justify-between py-2 border-b border-slate-50 last:border-0">
    <span className="text-xs font-black uppercase tracking-[0.15em] text-slate-400 shrink-0">{label}</span>
    <span className={`text-sm font-bold text-right ml-4 ${highlight ? 'text-brand text-lg' : 'text-slate-900'}`}>{value}</span>
  </div>
);
