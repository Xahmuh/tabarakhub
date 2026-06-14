import { supabaseClient } from '../lib/supabaseClient';
import { LostSale, Product, Role, Shortage } from '../types';
import { isUUID, generateUUID } from '../utils/uuid';
import { isDemoMode } from '../config/clientConfig';
import { BAHRAIN_VAT_RATE } from '../utils/vat';

const SALES_KEY = 'tabarak_offline_sales';
const PRODUCTS_KEY = 'tabarak_offline_products';

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

const throwUnlessDemoMode = (error: unknown) => {
  if (!isDemoMode) throw error;
};

type BranchScopedListOptions = {
  timestampFrom?: Date | string | null;
  timestampTo?: Date | string | null;
  maxRows?: number;
};

const PAGE_SIZE = 1000;

const normalizeTimestampBound = (value?: Date | string | null) => {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const applyTimestampBounds = (query: any, options?: BranchScopedListOptions) => {
  const from = normalizeTimestampBound(options?.timestampFrom);
  const to = normalizeTimestampBound(options?.timestampTo);
  if (from) query = query.gte('timestamp', from);
  if (to) query = query.lte('timestamp', to);
  return query;
};

const isWithinTimestampBounds = (timestamp: string, options?: BranchScopedListOptions) => {
  const value = new Date(timestamp).getTime();
  if (Number.isNaN(value)) return false;

  const from = normalizeTimestampBound(options?.timestampFrom);
  const to = normalizeTimestampBound(options?.timestampTo);
  if (from && value < new Date(from).getTime()) return false;
  if (to && value > new Date(to).getTime()) return false;
  return true;
};

const getMaxRows = (options?: BranchScopedListOptions) =>
  typeof options?.maxRows === 'number' && Number.isFinite(options.maxRows) && options.maxRows > 0
    ? Math.floor(options.maxRows)
    : Number.POSITIVE_INFINITY;

export const saleService = {
  products: {
    list: async (branchId?: string): Promise<Product[]> => {
      try {
        let allProducts: any[] = [];
        let from = 0;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await supabaseClient
            .from('products')
            .select('*')
            .order('name')
            .range(from, from + PAGE_SIZE - 1);

          if (error) throw error;
          if (!data || data.length === 0) {
            hasMore = false;
          } else {
            allProducts = [...allProducts, ...data];
            if (data.length < PAGE_SIZE) {
              hasMore = false;
            } else {
              from += PAGE_SIZE;
            }
          }
        }

        if (allProducts.length > 0) return allProducts.map(p => ({
          id: p.id, name: p.name, category: p.category, agent: p.agent,
          defaultPrice: Number(p.default_price || 0), isManual: !!p.is_manual,
          vatEnabled: !!p.vat_enabled, vatRate: Number(p.vat_rate ?? BAHRAIN_VAT_RATE),
          internalCode: p.internal_code, internationalCode: p.international_code,
          createdByBranch: p.created_by_branch
        }));
        return [];
      } catch (e) {
        return [];
      }
    },
    search: async (query: string, branchId?: string) => {
      const q = query.trim().toLowerCase();
      if (!q) return [];
      try {
        const { data } = await supabaseClient
          .from('products')
          .select('*')
          .or(`name.ilike.%${q}%,internal_code.ilike.%${q}%,international_code.eq.${q}`)
          .limit(20);
        if (data && data.length > 0) return data.map(p => ({
          id: p.id, name: p.name, category: p.category, agent: p.agent,
          defaultPrice: Number(p.default_price || 0), isManual: !!p.is_manual,
          vatEnabled: !!p.vat_enabled, vatRate: Number(p.vat_rate ?? BAHRAIN_VAT_RATE),
          internalCode: p.internal_code, internationalCode: p.international_code,
          createdByBranch: p.created_by_branch
        }));
        if (!isDemoMode) return [];
        throw new Error("No remote results");
      } catch (e) {
        throwUnlessDemoMode(e);
        const localProducts = readDemoArray<Product>(PRODUCTS_KEY);
        const allLocal = [...localProducts];
        return allLocal.filter(p =>
          p.name.toLowerCase().includes(q) ||
          p.internalCode?.toLowerCase().includes(q) ||
          p.internationalCode === q
        ).slice(0, 20);
      }
    },
    create: async (product: Omit<Product, 'id'>) => {
      try {
        const { data, error } = await supabaseClient.from('products').insert([{
          name: product.name, category: product.category, agent: product.agent,
          default_price: Number(product.defaultPrice || 0), is_manual: true,
          vat_enabled: !!product.vatEnabled, vat_rate: Number(product.vatRate ?? BAHRAIN_VAT_RATE),
          created_by_branch: product.createdByBranch
        }]).select().single();
        if (error) throw error;
        return {
          id: data.id, name: data.name, category: data.category, agent: data.agent,
          defaultPrice: Number(data.default_price || 0), isManual: !!data.is_manual,
          vatEnabled: !!data.vat_enabled, vatRate: Number(data.vat_rate ?? BAHRAIN_VAT_RATE),
          internalCode: data.internal_code, internationalCode: data.international_code,
          createdByBranch: data.created_by_branch
        };
      } catch (e) {
        throwUnlessDemoMode(e);
        const newProd = { ...product, id: Math.random().toString(36).substr(2, 9) };
        const offline = readDemoArray<Product>(PRODUCTS_KEY);
        offline.push(newProd);
        writeDemoArray(PRODUCTS_KEY, offline);
        return newProd;
      }
    }
  },

  manualProducts: {
    create: async (data: any) => {
      try {
        const { data: result, error } = await supabaseClient.from('manual_products').insert([{
          name: data.name, category: data.category, agent: data.agent,
          default_price: data.defaultPrice, created_by_branch: data.createdByBranch
        }]).select().single();
        if (error) throw error;
        return result;
      } catch (e) {
        throwUnlessDemoMode(e);
        const offline = readDemoArray<Record<string, unknown>>('tabarak_manual_products_log');
        const entry = { ...data, id: 'manual-' + Math.random().toString(36).substr(2, 9), timestamp: new Date().toISOString() };
        offline.push(entry);
        writeDemoArray('tabarak_manual_products_log', offline);
        return entry;
      }
    }
  },

  sales: {
    list: async (branchId?: string, role: Role = 'branch', options?: BranchScopedListOptions): Promise<LostSale[]> => {
      let remoteData: LostSale[] = [];
      try {
        if (role === 'branch' && !isUUID(branchId)) return [];

        let allRecords: any[] = [];
        let from = 0;
        const maxRows = getMaxRows(options);
        let hasMore = true;
        while (hasMore && allRecords.length < maxRows) {
          let query = supabaseClient.from('lost_sales').select('*');
          if (role !== 'branch' && branchId && branchId !== 'all') {
            if (isUUID(branchId)) query = query.eq('branch_id', branchId);
          } else if (role === 'branch') {
            if (isUUID(branchId)) query = query.eq('branch_id', branchId);
          }
          query = applyTimestampBounds(query, options);
          const currentPageSize = Math.min(PAGE_SIZE, maxRows - allRecords.length);
          const { data, error } = await query
            .order('timestamp', { ascending: false })
            .range(from, from + currentPageSize - 1);
          if (error) throw error;
          if (!data || data.length === 0) {
            hasMore = false;
          } else {
            allRecords = [...allRecords, ...data];
            if (data.length < currentPageSize || allRecords.length >= maxRows) hasMore = false; else from += currentPageSize;
          }
        }
        remoteData = allRecords.map(s => ({
          id: s.id, branchId: s.branch_id, pharmacistId: s.pharmacist_id,
          pharmacistName: s.pharmacist_name, productId: s.product_id,
          productName: s.product_name, agentName: s.agent_name, category: s.category,
          unitPrice: Number(s.unit_price || 0), quantity: Number(s.quantity || 0),
          totalValue: Number(s.total_value || 0), lostDate: s.lost_date,
          lostHour: Number(s.lost_hour || 0), timestamp: s.timestamp,
          isManual: !!s.is_manual, priceSource: s.price_source || 'db',
          sessionId: s.session_id, notes: s.notes,
          alternativeGiven: !!s.alternative_given,
          internalTransfer: !!s.internal_transfer,
          internalCode: s.internal_code
        }));
      } catch (e) {
        throwUnlessDemoMode(e);
      }
      const localData = readDemoArray<LostSale>(SALES_KEY);
      const filteredLocal = (branchId && branchId !== 'all' ? localData.filter(s => s.branchId === branchId) : localData)
        .filter(s => isWithinTimestampBounds(s.timestamp, options));
      const combined = [...remoteData, ...filteredLocal].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      const seen = new Set();
      return combined.filter(item => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
    },
    insert: async (sale: Omit<LostSale, 'id' | 'totalValue' | 'timestamp' | 'lostDate' | 'lostHour'>) => {
      const now = new Date();
      const id = generateUUID();
      const payload = {
        branch_id: sale.branchId,
        pharmacist_id: sale.pharmacistId,
        pharmacist_name: sale.pharmacistName,
        product_id: isUUID(sale.productId) ? sale.productId : null,
        product_name: sale.productName,
        agent_name: sale.agentName || 'N/A',
        category: sale.category || 'General',
        unit_price: Number(sale.unitPrice || 0),
        quantity: Number(sale.quantity || 1),
        is_manual: !!sale.isManual,
        price_source: sale.priceSource || 'db',
        lost_date: now.toISOString().split('T')[0],
        lost_hour: now.getHours(),
        timestamp: (sale as any).timestamp || now.toISOString(),
        total_value: Number((Number(sale.unitPrice || 0) * Number(sale.quantity || 1)).toFixed(3)),
        notes: sale.notes || null,
        alternative_given: !!sale.alternativeGiven,
        internal_transfer: !!sale.internalTransfer,
        internal_code: (sale as any).internalCode || null
      };
      if (!isUUID(payload.branch_id) || !isUUID(payload.pharmacist_id)) throw new Error("Invalid Node Identity Configuration");
      try {
        const { data, error } = await supabaseClient.from('lost_sales').insert([payload]).select().single();
        if (error) throw error;
        const mapped: LostSale = {
          ...sale,
          id: data.id,
          totalValue: data.total_value,
          timestamp: data.timestamp,
          lostDate: data.lost_date,
          lostHour: data.lost_hour
        } as LostSale;
        window.dispatchEvent(new CustomEvent('tabarak_sales_updated', { detail: mapped }));
        return mapped;
      } catch (e) {
        throwUnlessDemoMode(e);
        const offline = readDemoArray<LostSale>(SALES_KEY);
        const newSale: LostSale = { ...sale, id, totalValue: payload.total_value, timestamp: payload.timestamp, lostDate: payload.lost_date, lostHour: payload.lost_hour } as LostSale;
        offline.push(newSale);
        writeDemoArray(SALES_KEY, offline);
        window.dispatchEvent(new CustomEvent('tabarak_sales_updated', { detail: newSale }));
        return newSale;
      }
    },
    delete: async (id: string) => {
      try {
        if (isUUID(id)) await supabaseClient.from('lost_sales').delete().eq('id', id);
      } catch (e) {
        throwUnlessDemoMode(e);
      }
      const offline = readDemoArray<LostSale>(SALES_KEY);
      writeDemoArray(SALES_KEY, offline.filter(s => s.id !== id));
      window.dispatchEvent(new CustomEvent('tabarak_sales_updated'));
      return true;
    }
  },

  shortages: {
    list: async (branchId?: string, role: Role = 'branch', options?: BranchScopedListOptions): Promise<Shortage[]> => {
      let remoteData: Shortage[] = [];
      try {
        if (role === 'branch' && !isUUID(branchId)) return [];

        let allRecords: any[] = [];
        let from = 0;
        const maxRows = getMaxRows(options);
        let hasMore = true;
        while (hasMore && allRecords.length < maxRows) {
          let query = supabaseClient.from('shortages').select('*');
          if (role !== 'branch' && branchId && branchId !== 'all' && isUUID(branchId)) query = query.eq('branch_id', branchId);
          else if (role === 'branch' && isUUID(branchId)) query = query.eq('branch_id', branchId);
          query = applyTimestampBounds(query, options);
          const currentPageSize = Math.min(PAGE_SIZE, maxRows - allRecords.length);
          const { data, error } = await query
            .order('timestamp', { ascending: false })
            .range(from, from + currentPageSize - 1);
          if (error) throw error;
          if (!data || data.length === 0) {
            hasMore = false;
          } else {
            allRecords = [...allRecords, ...data];
            if (data.length < currentPageSize || allRecords.length >= maxRows) hasMore = false; else from += currentPageSize;
          }
        }
        remoteData = allRecords.map(s => ({
          id: s.id, branchId: s.branch_id, pharmacistId: s.pharmacist_id,
          productId: s.product_id, productName: s.product_name,
          agentName: s.agent_name, status: s.status,
          pharmacistName: s.pharmacist_name, timestamp: s.timestamp,
          notes: s.notes, internalCode: s.internal_code, history: s.history || []
        }));
      } catch (e) {
        throwUnlessDemoMode(e);
      }
      const localData = readDemoArray<Shortage>('tabarak_offline_shortages');
      const filteredLocal = (branchId && branchId !== 'all' ? localData.filter((s: any) => s.branchId === branchId) : localData)
        .filter(s => isWithinTimestampBounds(s.timestamp, options));
      const combined = [...remoteData, ...filteredLocal].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      const seen = new Set();
      return combined.filter((item: any) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
    },
    create: async (shortage: Omit<Shortage, 'id'>) => {
      try {
        if (!isUUID(shortage.branchId) || !isUUID(shortage.pharmacistId)) throw new Error("Invalid IDs");
        let query = supabaseClient.from('shortages').select('*').eq('branch_id', shortage.branchId).eq('product_name', shortage.productName);
        if (isUUID(shortage.productId)) query = query.eq('product_id', shortage.productId);
        const { data: existingList } = await query;
        const existing = existingList?.[0];
        if (existing) {
          const history = existing.history || [];
          history.push({ status: existing.status, timestamp: existing.timestamp, pharmacistName: existing.pharmacist_name });
          const { data, error } = await supabaseClient.from('shortages').update({
            status: shortage.status,
            timestamp: shortage.timestamp,
            pharmacist_name: shortage.pharmacistName,
            pharmacist_id: shortage.pharmacistId,
            agent_name: shortage.agentName || 'N/A',
            notes: shortage.notes,
            internal_code: shortage.internalCode,
            history
          }).eq('id', existing.id).select().single();
          if (error) throw error;
          window.dispatchEvent(new CustomEvent('tabarak_shortages_updated'));
          return {
            id: data.id, branchId: data.branch_id, pharmacistId: data.pharmacist_id,
            productId: data.product_id, productName: data.product_name,
            agentName: data.agent_name, status: data.status,
            pharmacistName: data.pharmacist_name, timestamp: data.timestamp,
            history: data.history, notes: data.notes, internalCode: data.internal_code
          } as Shortage;
        } else {
          const { data, error } = await supabaseClient.from('shortages').insert([{
            branch_id: shortage.branchId, pharmacist_id: shortage.pharmacistId,
            product_id: isUUID(shortage.productId) ? shortage.productId : null,
            product_name: shortage.productName, agent_name: shortage.agentName || 'N/A',
            status: shortage.status, pharmacist_name: shortage.pharmacistName,
            timestamp: shortage.timestamp, notes: shortage.notes, internal_code: shortage.internalCode, history: []
          }]).select().single();
          if (error) throw error;
          window.dispatchEvent(new CustomEvent('tabarak_shortages_updated'));
          return {
            id: data.id, branchId: data.branch_id, pharmacistId: data.pharmacist_id,
            productId: data.product_id, productName: data.product_name,
            agentName: data.agent_name, status: data.status,
            pharmacistName: data.pharmacist_name, timestamp: data.timestamp,
            history: data.history, notes: data.notes, internalCode: data.internal_code
          } as Shortage;
        }
      } catch (e) {
        throwUnlessDemoMode(e);
        const offline = readDemoArray<Shortage>('tabarak_offline_shortages');
        const idx = offline.findIndex((s: any) => s.branchId === shortage.branchId && (shortage.productId ? s.productId === shortage.productId : s.productName === shortage.productName));
        if (idx >= 0) {
          const item = offline[idx];
          const history = item.history || [];
          history.push({ status: item.status, timestamp: item.timestamp, pharmacistName: item.pharmacistName });
          offline[idx] = { ...item, status: shortage.status, timestamp: shortage.timestamp, pharmacistName: shortage.pharmacistName, pharmacistId: shortage.pharmacistId, history };
          writeDemoArray('tabarak_offline_shortages', offline);
          window.dispatchEvent(new CustomEvent('tabarak_shortages_updated'));
          return offline[idx];
        } else {
          const newItem = { ...shortage, id: Math.random().toString(36).substr(2, 9), history: [] };
          offline.push(newItem);
          writeDemoArray('tabarak_offline_shortages', offline);
          window.dispatchEvent(new CustomEvent('tabarak_shortages_updated'));
          return newItem;
        }
      }
    },
    delete: async (id: string) => {
      try {
        if (isUUID(id)) await supabaseClient.from('shortages').delete().eq('id', id);
      } catch (e) {
        throwUnlessDemoMode(e);
      }
      const offline = readDemoArray<Shortage>('tabarak_offline_shortages');
      writeDemoArray('tabarak_offline_shortages', offline.filter(s => s.id !== id));
      window.dispatchEvent(new CustomEvent('tabarak_shortages_updated'));
      return true;
    }
  }
};
