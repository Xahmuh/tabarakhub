import { supabaseClient } from '../lib/supabase';
import { LostSale, Product, Role, Shortage } from '../types';
import { isUUID, generateUUID } from '../utils/uuid';

const SALES_KEY = 'tabarak_offline_sales';
const PRODUCTS_KEY = 'tabarak_offline_products';

export const saleService = {
  products: {
    list: async (branchId?: string): Promise<Product[]> => {
      try {
        const { data } = await supabaseClient.from('products').select('*');
        if (data) return data.map(p => ({
          id: p.id, name: p.name, category: p.category, agent: p.agent,
          defaultPrice: Number(p.default_price || 0), isManual: !!p.is_manual,
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
          internalCode: p.internal_code, internationalCode: p.international_code,
          createdByBranch: p.created_by_branch
        }));
        throw new Error("No remote results");
      } catch (e) {
        const localProducts: Product[] = JSON.parse(localStorage.getItem(PRODUCTS_KEY) || '[]');
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
          created_by_branch: product.createdByBranch
        }]).select().single();
        if (error) throw error;
        return {
          id: data.id, name: data.name, category: data.category, agent: data.agent,
          defaultPrice: Number(data.default_price || 0), isManual: !!data.is_manual,
          internalCode: data.internal_code, internationalCode: data.international_code,
          createdByBranch: data.created_by_branch
        };
      } catch (e) {
        const newProd = { ...product, id: Math.random().toString(36).substr(2, 9) };
        const offline = JSON.parse(localStorage.getItem(PRODUCTS_KEY) || '[]');
        offline.push(newProd);
        localStorage.setItem(PRODUCTS_KEY, JSON.stringify(offline));
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
        const offline = JSON.parse(localStorage.getItem('tabarak_manual_products_log') || '[]');
        const entry = { ...data, id: 'manual-' + Math.random().toString(36).substr(2, 9), timestamp: new Date().toISOString() };
        offline.push(entry);
        localStorage.setItem('tabarak_manual_products_log', JSON.stringify(offline));
        return entry;
      }
    }
  },

  sales: {
    list: async (branchId?: string, role: Role = 'branch'): Promise<LostSale[]> => {
      let remoteData: LostSale[] = [];
      try {
        let allRecords: any[] = [];
        let from = 0;
        let pageSize = 1000;
        let hasMore = true;
        while (hasMore) {
          let query = supabaseClient.from('lost_sales').select('*');
          if ((role === 'admin' || role === 'manager') && branchId && branchId !== 'all') {
            if (isUUID(branchId)) query = query.eq('branch_id', branchId);
          } else if (role === 'branch') {
            if (isUUID(branchId)) query = query.eq('branch_id', branchId);
          }
          const { data, error } = await query
            .order('timestamp', { ascending: false })
            .range(from, from + pageSize - 1);
          if (error) throw error;
          if (!data || data.length === 0) {
            hasMore = false;
          } else {
            allRecords = [...allRecords, ...data];
            if (data.length < pageSize) hasMore = false; else from += pageSize;
          }
          if (allRecords.length >= 100000) hasMore = false;
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
      } catch (e) { }
      const localData: LostSale[] = JSON.parse(localStorage.getItem(SALES_KEY) || '[]');
      const filteredLocal = branchId && branchId !== 'all' ? localData.filter(s => s.branchId === branchId) : localData;
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
        const offline = JSON.parse(localStorage.getItem(SALES_KEY) || '[]');
        const newSale: LostSale = { ...sale, id, totalValue: payload.total_value, timestamp: payload.timestamp, lostDate: payload.lost_date, lostHour: payload.lost_hour } as LostSale;
        offline.push(newSale);
        localStorage.setItem(SALES_KEY, JSON.stringify(offline));
        window.dispatchEvent(new CustomEvent('tabarak_sales_updated', { detail: newSale }));
        return newSale;
      }
    },
    delete: async (id: string) => {
      try {
        if (isUUID(id)) await supabaseClient.from('lost_sales').delete().eq('id', id);
      } catch (e) { }
      const offline = JSON.parse(localStorage.getItem(SALES_KEY) || '[]');
      localStorage.setItem(SALES_KEY, JSON.stringify(offline.filter((s: any) => s.id !== id)));
      window.dispatchEvent(new CustomEvent('tabarak_sales_updated'));
      return true;
    }
  },

  shortages: {
    list: async (branchId?: string, role: Role = 'branch'): Promise<Shortage[]> => {
      let remoteData: Shortage[] = [];
      try {
        let allRecords: any[] = [];
        let from = 0;
        let pageSize = 1000;
        let hasMore = true;
        while (hasMore) {
          let query = supabaseClient.from('shortages').select('*');
          if ((role === 'admin' || role === 'manager') && branchId && branchId !== 'all' && isUUID(branchId)) query = query.eq('branch_id', branchId);
          else if (role === 'branch' && isUUID(branchId)) query = query.eq('branch_id', branchId);
          const { data, error } = await query
            .order('timestamp', { ascending: false })
            .range(from, from + pageSize - 1);
          if (error) throw error;
          if (!data || data.length === 0) {
            hasMore = false;
          } else {
            allRecords = [...allRecords, ...data];
            if (data.length < pageSize) hasMore = false; else from += pageSize;
          }
        }
        remoteData = allRecords.map(s => ({
          id: s.id, branchId: s.branch_id, pharmacistId: s.pharmacist_id,
          productId: s.product_id, productName: s.product_name,
          agentName: s.agent_name, status: s.status,
          pharmacistName: s.pharmacist_name, timestamp: s.timestamp,
          notes: s.notes, internalCode: s.internal_code, history: s.history || []
        }));
      } catch (e) { }
      const localData = JSON.parse(localStorage.getItem('tabarak_offline_shortages') || '[]');
      const filteredLocal = branchId && branchId !== 'all' ? localData.filter((s: any) => s.branchId === branchId) : localData;
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
        const offline = JSON.parse(localStorage.getItem('tabarak_offline_shortages') || '[]');
        const idx = offline.findIndex((s: any) => s.branchId === shortage.branchId && (shortage.productId ? s.productId === shortage.productId : s.productName === shortage.productName));
        if (idx >= 0) {
          const item = offline[idx];
          const history = item.history || [];
          history.push({ status: item.status, timestamp: item.timestamp, pharmacistName: item.pharmacistName });
          offline[idx] = { ...item, status: shortage.status, timestamp: shortage.timestamp, pharmacistName: shortage.pharmacistName, pharmacistId: shortage.pharmacistId, history };
          localStorage.setItem('tabarak_offline_shortages', JSON.stringify(offline));
          window.dispatchEvent(new CustomEvent('tabarak_shortages_updated'));
          return offline[idx];
        } else {
          const newItem = { ...shortage, id: Math.random().toString(36).substr(2, 9), history: [] };
          offline.push(newItem);
          localStorage.setItem('tabarak_offline_shortages', JSON.stringify(offline));
          window.dispatchEvent(new CustomEvent('tabarak_shortages_updated'));
          return newItem;
        }
      }
    },
    delete: async (id: string) => {
      try {
        if (isUUID(id)) await supabaseClient.from('shortages').delete().eq('id', id);
      } catch (e) { }
      const offline = JSON.parse(localStorage.getItem('tabarak_offline_shortages') || '[]');
      localStorage.setItem('tabarak_offline_shortages', JSON.stringify(offline.filter((s: any) => s.id !== id)));
      window.dispatchEvent(new CustomEvent('tabarak_shortages_updated'));
      return true;
    }
  }
};
