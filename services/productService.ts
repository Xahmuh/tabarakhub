
import { supabaseClient } from '../lib/supabaseClient';
import { Product } from '../types';
import { BAHRAIN_VAT_RATE } from '../utils/vat';

const PRODUCT_BULK_CHUNK_SIZE = 500;
const chunkRows = <T,>(rows: T[], size = PRODUCT_BULK_CHUNK_SIZE): T[][] => {
    const chunks: T[][] = [];
    for (let i = 0; i < rows.length; i += size) {
        chunks.push(rows.slice(i, i + size));
    }
    return chunks;
};

const normalizeInternalCode = (code?: string | number | null) => code?.toString().trim().toUpperCase() || '';

const isMissingInternalCodeConstraint = (error: any) =>
    error?.code === '42P10' ||
    String(error?.message || '').toLowerCase().includes('unique or exclusion constraint');

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
            vatEnabled: !!p.vat_enabled,
            vatRate: Number(p.vat_rate ?? BAHRAIN_VAT_RATE),
            isManual: p.is_manual,
            createdByBranch: p.created_by_branch,
            internationalCode: p.international_code
        }));
    },

    // Secure Bulk Upload
    bulkUpsertProducts: async (rows: any[]): Promise<{ inserted: number; updated: number; failed: number }> => {
        if (rows.length === 0) return { inserted: 0, updated: 0, failed: 0 };

        const rowsByInternalCode = new Map<string, any>();
        rows.forEach(row => {
            const internalCode = normalizeInternalCode(row.internal_code);
            if (!internalCode) return;
            rowsByInternalCode.set(internalCode, {
                ...row,
                internal_code: internalCode
            });
        });

        const dedupedRows = Array.from(rowsByInternalCode.values());
        if (dedupedRows.length === 0) return { inserted: 0, updated: 0, failed: rows.length };

        const internalCodes = dedupedRows.map(r => r.internal_code);

        // Check existing to calculate inserted vs updated stats
        const existingCodes = new Set<string>();
        for (const codeChunk of chunkRows(internalCodes)) {
            const { data: existing, error: checkError } = await supabaseClient
                .from('products')
                .select('internal_code')
                .in('internal_code', codeChunk);

            if (checkError) throw checkError;
            existing?.forEach(e => existingCodes.add(normalizeInternalCode(e.internal_code)));
        }
        let insertedCount = 0;
        let updatedCount = 0;

        dedupedRows.forEach(r => {
            if (existingCodes.has(r.internal_code)) {
                updatedCount++;
            } else {
                insertedCount++;
            }
        });

        // Prepare payload
        const payload = dedupedRows.map(r => ({
            internal_code: r.internal_code,
            name: r.name,
            category: r.category,
            agent: r.agent,
            default_price: r.default_price,
            vat_enabled: !!r.vat_enabled,
            vat_rate: BAHRAIN_VAT_RATE,
            is_manual: true // FORCE TRUE
        }));

        // Perform chunked upserts to avoid request-size limits for large catalogs.
        for (const payloadChunk of chunkRows(payload)) {
            const { error } = await supabaseClient
                .from('products')
                .upsert(payloadChunk, { onConflict: 'internal_code', ignoreDuplicates: false });

            if (error) {
                if (isMissingInternalCodeConstraint(error)) {
                    throw new Error('Product bulk upload requires a unique database constraint on products.internal_code. Apply migration 20260612194500_enforce_unique_product_internal_code.sql before importing catalog files.');
                }
                throw error;
            }
        }

        return {
            inserted: insertedCount,
            updated: updatedCount,
            failed: 0 // If we reached here, 0 failed in database op (atomic)
        };
    },

    // Manual Create
    createProduct: async (product: Partial<Product>) => {
        const internalCode = normalizeInternalCode(product.internalCode);
        const payload = {
            internal_code: internalCode || null,
            name: product.name,
            category: product.category,
            agent: product.agent,
            default_price: product.defaultPrice,
            vat_enabled: !!product.vatEnabled,
            vat_rate: BAHRAIN_VAT_RATE,
            is_manual: product.isManual === undefined ? true : product.isManual
        };

        if (internalCode) {
            const { data: existing, error: lookupError } = await supabaseClient
                .from('products')
                .select('id')
                .eq('internal_code', internalCode)
                .limit(1);

            if (lookupError) throw lookupError;

            const existingId = existing?.[0]?.id;
            if (existingId) {
                const { data, error } = await supabaseClient
                    .from('products')
                    .update(payload)
                    .eq('id', existingId)
                    .select()
                    .single();

                if (error) throw error;
                return data;
            }
        }

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
        if (updates.vatEnabled !== undefined) payload.vat_enabled = !!updates.vatEnabled;
        if (updates.vatRate !== undefined) payload.vat_rate = Number(updates.vatRate ?? BAHRAIN_VAT_RATE);
        if (updates.isManual !== undefined) payload.is_manual = updates.isManual;
        // internal_code is read-only in UI usually, but if passed:
        if (updates.internalCode !== undefined) payload.internal_code = normalizeInternalCode(updates.internalCode) || null;

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
