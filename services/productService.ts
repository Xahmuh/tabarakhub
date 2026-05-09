
import { supabaseClient } from '../lib/supabase';
import { Product } from '../types';

export const productService = {
    getProductsForExport: async (): Promise<Product[]> => {
        let allData: any[] = [];
        let from = 0;
        const step = 1000;
        let hasMore = true;

        while (hasMore) {
            const { data, error } = await supabaseClient
                .from('products')
                .select('*')
                .order('name')
                .range(from, from + step - 1);

            if (error) throw error;

            if (data && data.length > 0) {
                allData = [...allData, ...data];
                from += step;
                // If we got fewer than step, we are done
                if (data.length < step) hasMore = false;
            } else {
                hasMore = false;
            }
        }

        return allData.map((p: any) => ({
            id: p.id,
            internalCode: p.internal_code,
            name: p.name,
            category: p.category,
            agent: p.agent,
            defaultPrice: p.default_price,
            isManual: p.is_manual,
            createdByBranch: p.created_by_branch,
            internationalCode: p.international_code
        }));
    },

    // Secure Bulk Upload
    bulkUpsertProducts: async (rows: any[]): Promise<{ inserted: number; updated: number; failed: number }> => {
        if (rows.length === 0) return { inserted: 0, updated: 0, failed: 0 };

        const internalCodes = rows.map(r => r.internal_code);

        // Check existing to calculate inserted vs updated stats
        const { data: existing, error: checkError } = await supabaseClient
            .from('products')
            .select('internal_code')
            .in('internal_code', internalCodes);

        if (checkError) throw checkError;

        const existingCodes = new Set(existing?.map(e => e.internal_code));
        let insertedCount = 0;
        let updatedCount = 0;

        rows.forEach(r => {
            if (existingCodes.has(r.internal_code)) {
                updatedCount++;
            } else {
                insertedCount++;
            }
        });

        // Prepare payload
        const payload = rows.map(r => ({
            internal_code: r.internal_code,
            name: r.name,
            category: r.category,
            agent: r.agent,
            default_price: r.default_price,
            is_manual: true // FORCE TRUE
        }));

        // Perform Upsert
        const { error } = await supabaseClient
            .from('products')
            .upsert(payload, { onConflict: 'internal_code' });

        if (error) throw error; // Rollback/Fail

        return {
            inserted: insertedCount,
            updated: updatedCount,
            failed: 0 // If we reached here, 0 failed in database op (atomic)
        };
    },

    // Manual Create
    createProduct: async (product: Partial<Product>) => {
        const payload = {
            internal_code: product.internalCode,
            name: product.name,
            category: product.category,
            agent: product.agent,
            default_price: product.defaultPrice,
            is_manual: product.isManual === undefined ? true : product.isManual
        };

        // Check uniqueness manually for better error message if needed, or let DB throw
        const { data, error } = await supabaseClient
            .from('products')
            .insert([payload])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    // Manual Update
    updateProduct: async (id: string, updates: Partial<Product>) => {
        // Map camelCase to snake_case
        const payload: any = {};
        if (updates.name !== undefined) payload.name = updates.name;
        if (updates.category !== undefined) payload.category = updates.category;
        if (updates.agent !== undefined) payload.agent = updates.agent;
        if (updates.defaultPrice !== undefined) payload.default_price = updates.defaultPrice;
        if (updates.isManual !== undefined) payload.is_manual = updates.isManual;
        // internal_code is read-only in UI usually, but if passed:
        if (updates.internalCode !== undefined) payload.internal_code = updates.internalCode;

        const { data, error } = await supabaseClient
            .from('products')
            .update(payload)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    deleteProduct: async (id: string) => {
        const { error } = await supabaseClient.from('products').delete().eq('id', id);
        if (error) throw error;
    }
};
