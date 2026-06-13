import { supabaseClient } from '../lib/supabaseClient';
import { Supplier, Cheque, Expense, ActualRevenue, ExpectedRevenue, CashFlowSettings, CashDifference, Role } from '../types';
import { generateUUID, isUUID } from '../utils/uuid';
import { isDemoMode } from '../config/clientConfig';

const readDemoArray = <T>(key: string): T[] => {
  if (!isDemoMode) return [];
  try {
    return JSON.parse(localStorage.getItem(key) || '[]') as T[];
  } catch {
    return [];
  }
};

const writeDemoArray = <T>(key: string, data: T[]) => {
  if (!isDemoMode) return;
  localStorage.setItem(key, JSON.stringify(data));
};

const readDemoValue = <T>(key: string, fallback: T): T => {
  if (!isDemoMode) return fallback;
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)) as T;
  } catch {
    return fallback;
  }
};

const throwUnlessDemoMode = (error: unknown) => {
  if (!isDemoMode) throw error;
};

export const financeService = {
  cashFlow: {
    suppliers: {
      list: async (): Promise<Supplier[]> => {
        try {
          const { data, error } = await supabaseClient.from('suppliers').select('*').order('name');
          if (error) throw error;
          return data.map(s => ({ id: s.id, name: s.name, flexibilityLevel: s.flexibility_level, notes: s.notes }));
        } catch (e) {
          throwUnlessDemoMode(e);
          return readDemoArray<Supplier>('tabarak_cf_suppliers');
        }
      },
      upsert: async (supplier: Omit<Supplier, 'id'> & { id?: string }) => {
        const id = supplier.id || generateUUID();
        const payload = { id, name: supplier.name, flexibility_level: supplier.flexibilityLevel, notes: supplier.notes };
        try {
          const { data, error } = await supabaseClient.from('suppliers').upsert([payload]).select().single();
          if (error) throw error;
          return { id: data.id, name: data.name, flexibilityLevel: data.flexibility_level, notes: data.notes };
        } catch (e) {
          throwUnlessDemoMode(e);
          const offline = readDemoArray<Supplier>('tabarak_cf_suppliers');
          const idx = offline.findIndex(s => s.id === id);
          const newSupp = { ...supplier, id };
          if (idx >= 0) offline[idx] = newSupp; else offline.push(newSupp);
          writeDemoArray('tabarak_cf_suppliers', offline);
          return newSupp;
        }
      }
    },
    cheques: {
      list: async (): Promise<Cheque[]> => {
        try {
          const { data, error } = await supabaseClient.from('cheques').select('*').order('due_date');
          if (error) throw error;
          return data.map(c => ({
            id: c.id, supplierId: c.supplier_id, chequeNumber: c.cheque_number,
            amount: Number(c.amount), dueDate: c.due_date, priority: c.priority,
            status: c.status, delayReason: c.delay_reason, executionTime: c.execution_time, createdAt: c.created_at
          }));
        } catch (e) {
          throwUnlessDemoMode(e);
          return readDemoArray<Cheque>('tabarak_cf_cheques');
        }
      },
      upsert: async (cheque: Omit<Cheque, 'id' | 'createdAt'> & { id?: string }) => {
        const id = cheque.id || generateUUID();
        const payload = {
          id, supplier_id: cheque.supplierId, cheque_number: cheque.chequeNumber,
          amount: cheque.amount, due_date: cheque.dueDate, priority: cheque.priority,
          status: cheque.status, delay_reason: cheque.delayReason, execution_time: cheque.executionTime
        };
        try {
          const { data, error } = await supabaseClient.from('cheques').upsert([payload]).select().single();
          if (error) throw error;
          return {
            id: data.id, supplierId: data.supplier_id, chequeNumber: data.cheque_number,
            amount: Number(data.amount), dueDate: data.due_date, priority: data.priority,
            status: data.status, delayReason: data.delay_reason, executionTime: data.execution_time, createdAt: data.created_at
          };
        } catch (e) {
          throwUnlessDemoMode(e);
          const offline = readDemoArray<Cheque>('tabarak_cf_cheques');
          const idx = offline.findIndex(c => c.id === id);
          const newCheque = { ...cheque, id, createdAt: new Date().toISOString() };
          if (idx >= 0) offline[idx] = newCheque; else offline.push(newCheque);
          writeDemoArray('tabarak_cf_cheques', offline);
          return newCheque;
        }
      }
    },
    expenses: {
      list: async (): Promise<Expense[]> => {
        try {
          const { data, error } = await supabaseClient.from('expenses').select('*').order('expense_date');
          if (error) throw error;
          return data.map(e => ({
            id: e.id, category: e.category, amount: Number(e.amount),
            expenseDate: e.expense_date, type: e.type, delayAllowed: e.delay_allowed,
            maxDelayDays: e.max_delay_days, priority: e.priority, notes: e.notes
          }));
        } catch (e) {
          throwUnlessDemoMode(e);
          return readDemoArray<Expense>('tabarak_cf_expenses');
        }
      },
      upsert: async (expense: Omit<Expense, 'id'> & { id?: string }) => {
        const id = expense.id || generateUUID();
        const payload = {
          id, category: expense.category, amount: expense.amount,
          expense_date: expense.expenseDate, type: expense.type,
          delay_allowed: expense.delayAllowed, max_delay_days: expense.maxDelayDays,
          priority: expense.priority, notes: expense.notes
        };
        try {
          const { data, error } = await supabaseClient.from('expenses').upsert([payload]).select().single();
          if (error) throw error;
          return {
            id: data.id, category: data.category, amount: Number(data.amount),
            expenseDate: data.expense_date, type: data.type, delayAllowed: data.delay_allowed,
            max_delay_days: data.max_delay_days, priority: data.priority, notes: data.notes
          };
        } catch (e) {
          throwUnlessDemoMode(e);
          const offline = readDemoArray<Expense>('tabarak_cf_expenses');
          const idx = offline.findIndex(ex => ex.id === id);
          const newExpense = { ...expense, id };
          if (idx >= 0) offline[idx] = newExpense; else offline.push(newExpense);
          writeDemoArray('tabarak_cf_expenses', offline);
          return newExpense;
        }
      }
    },
    revenuesActual: {
      list: async (): Promise<ActualRevenue[]> => {
        try {
          const { data, error } = await supabaseClient.from('revenues_actual').select('*').order('revenue_date', { ascending: false });
          if (error) throw error;
          return data.map(r => ({
            id: r.id, revenueDate: r.revenue_date, amount: Number(r.amount),
            paymentType: r.payment_type, settlementTime: r.settlement_time, createdAt: r.created_at
          }));
        } catch (e) {
          throwUnlessDemoMode(e);
          return readDemoArray<ActualRevenue>('tabarak_cf_rev_actual');
        }
      },
      upsert: async (revenue: Omit<ActualRevenue, 'id' | 'createdAt'> & { id?: string }) => {
        const id = revenue.id || generateUUID();
        const payload = { id, revenue_date: revenue.revenueDate, amount: revenue.amount, payment_type: revenue.paymentType, settlement_time: revenue.settlementTime };
        try {
          const { data, error } = await supabaseClient.from('revenues_actual').upsert([payload]).select().single();
          if (error) throw error;
          return {
            id: data.id, revenueDate: data.revenue_date, amount: Number(data.amount),
            paymentType: data.payment_type, settlementTime: data.settlement_time, createdAt: data.created_at
          };
        } catch (e) {
          throwUnlessDemoMode(e);
          const offline = readDemoArray<ActualRevenue>('tabarak_cf_rev_actual');
          const idx = offline.findIndex(r => r.id === id);
          const newRev = { ...revenue, id, createdAt: new Date().toISOString() };
          if (idx >= 0) offline[idx] = newRev; else offline.push(newRev);
          writeDemoArray('tabarak_cf_rev_actual', offline);
          return newRev;
        }
      }
    },
    revenuesExpected: {
      list: async (): Promise<ExpectedRevenue[]> => {
        try {
          const { data, error } = await supabaseClient.from('revenues_expected').select('*').order('expected_date');
          if (error) throw error;
          return data.map(r => ({
            id: r.id, expectedDate: r.expected_date, expectedAmount: Number(r.expected_amount),
            confidence: r.confidence, expectedTime: r.expected_time, reason: r.reason, createdAt: r.created_at
          }));
        } catch (e) {
          throwUnlessDemoMode(e);
          return readDemoArray<ExpectedRevenue>('tabarak_cf_rev_expected');
        }
      },
      upsert: async (revexp: Omit<ExpectedRevenue, 'id' | 'createdAt'> & { id?: string }) => {
        const id = revexp.id || generateUUID();
        const payload = {
          id, expected_date: revexp.expectedDate, expected_amount: revexp.expectedAmount,
          confidence: revexp.confidence, expected_time: revexp.expectedTime, reason: revexp.reason
        };
        try {
          const { data, error } = await supabaseClient.from('revenues_expected').upsert([payload]).select().single();
          if (error) throw error;
          return {
            id: data.id, expectedDate: data.expected_date, expectedAmount: Number(data.expected_amount),
            confidence: data.confidence, expectedTime: data.expected_time, reason: data.reason, createdAt: data.created_at
          };
        } catch (e) {
          throwUnlessDemoMode(e);
          const offline = readDemoArray<ExpectedRevenue>('tabarak_cf_rev_expected');
          const idx = offline.findIndex(r => r.id === id);
          const newExp = { ...revexp, id, createdAt: new Date().toISOString() };
          if (idx >= 0) offline[idx] = newExp; else offline.push(newExp);
          writeDemoArray('tabarak_cf_rev_expected', offline);
          return newExp;
        }
      }
    },
    settings: {
      get: async (): Promise<CashFlowSettings> => {
        try {
          const { data, error } = await supabaseClient.from('cash_flow_settings').select('*').eq('id', 'global').maybeSingle();
          if (error) throw error;
          if (!data) return { safeThreshold: 1000, initialBalance: 0, forecastHorizon: 30 };
          return {
            safeThreshold: Number(data.safe_threshold),
            initialBalance: Number(data.initial_balance),
            forecastHorizon: data.forecast_horizon
          };
        } catch (e) {
          throwUnlessDemoMode(e);
          return readDemoValue<CashFlowSettings>('tabarak_cf_settings', { safeThreshold: 1000, initialBalance: 0, forecastHorizon: 30 });
        }
      },
      update: async (settings: CashFlowSettings) => {
        const payload = {
          id: 'global',
          safe_threshold: settings.safeThreshold,
          initial_balance: settings.initialBalance,
          forecast_horizon: settings.forecastHorizon
        };
        try {
          await supabaseClient.from('cash_flow_settings').upsert([payload]);
        } catch (e) {
          throwUnlessDemoMode(e);
          if (isDemoMode) localStorage.setItem('tabarak_cf_settings', JSON.stringify(settings));
        }
        return settings;
      }
    }
  },
  cashDifferences: {
    list: async (branchId?: string, role: Role = 'branch'): Promise<CashDifference[]> => {
      try {
        let query = supabaseClient.from('cash_differences').select(`*, branches(name)`);
        if (role === 'branch') {
          if (!branchId) return [];
          query = query.eq('branch_id', branchId);
        }
        const { data, error } = await query.order('date', { ascending: false });
        if (error) throw error;
        return data.map(d => ({
          id: d.id, date: d.date, branchId: d.branch_id,
          branchName: d.branches ? (Array.isArray(d.branches) ? d.branches[0]?.name : d.branches?.name) : (d.branch_name || 'Unknown Branch'),
          pharmacistName: d.pharmacist_name, systemCash: Number(d.system_cash), actualCash: Number(d.actual_cash),
          difference: Number(d.difference), differenceType: d.difference_type, reason: d.reason,
          hasInvoices: d.has_invoices, invoiceReference: d.invoice_reference, status: d.status,
          managerComment: d.manager_comment, drawerBalance: d.drawer_balance ? Number(d.drawer_balance) : undefined,
          createdAt: d.created_at
        }));
      } catch (e) {
        throwUnlessDemoMode(e);
        const allData = readDemoArray<CashDifference>('tabarak_cash_differences');
        if (role === 'branch' && branchId) return allData.filter(d => d.branchId === branchId);
        return allData;
      }
    },
    upsert: async (diff: Omit<CashDifference, 'id' | 'createdAt'> & { id?: string }) => {
      const payload = {
        id: diff.id || generateUUID(), date: diff.date, branch_id: String(diff.branchId),
        pharmacist_name: diff.pharmacistName, system_cash: diff.systemCash, actual_cash: diff.actualCash,
        difference: diff.difference, difference_type: diff.differenceType, reason: diff.reason,
        has_invoices: diff.hasInvoices, invoice_reference: diff.invoiceReference, status: diff.status,
        manager_comment: diff.managerComment, drawer_balance: diff.drawerBalance, branch_name: diff.branchName
      };
      const { data, error } = await supabaseClient.from('cash_differences').upsert([payload]).select();
      if (error) throw error;
      return data ? data[0] : null;
    },
    delete: async (id: string) => {
      try {
        if (isUUID(id)) await supabaseClient.from('cash_differences').delete().eq('id', id);
      } catch (e) {
        throwUnlessDemoMode(e);
      }
      const offline = readDemoArray<CashDifference>('tabarak_cash_differences');
      writeDemoArray('tabarak_cash_differences', offline.filter(s => s.id !== id));
      return true;
    }
  }
};
