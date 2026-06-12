
import { supabaseClient } from '../lib/supabaseClient';
import { SpinPrize, SpinSession, Spin, Customer, BranchReview, VoucherShare, Branch } from '../types';
import { isDemoMode } from '../config/clientConfig';

const CUSTOMERS_KEY = 'tabarak_spinwin_customers';
const SPINS_KEY = 'tabarak_spinwin_spins';
const PRIZES_KEY = 'tabarak_spinwin_prizes';
const SESSIONS_KEY = 'tabarak_spinwin_sessions';

const getLocal = <T = Record<string, unknown>>(key: string): T[] => {
    if (!isDemoMode) return [];
    try {
        return JSON.parse(localStorage.getItem(key) || '[]') as T[];
    } catch {
        return [];
    }
};
const saveLocal = <T>(key: string, data: T[]) => {
    if (!isDemoMode) return;
    localStorage.setItem(key, JSON.stringify(data));
};
const throwUnlessDemoMode = (error: unknown) => {
    if (!isDemoMode) throw error;
};

const generateUUID = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback for non-secure contexts (HTTP)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

const fetchEnrichmentData = async (table: string, columns: string, ids: string[]) => {
    const uniqueIds = Array.from(new Set(ids)).filter(Boolean);
    if (uniqueIds.length === 0) return [];
    const chunkSize = 200;
    let results: any[] = [];
    for (let i = 0; i < uniqueIds.length; i += chunkSize) {
        const chunk = uniqueIds.slice(i, i + chunkSize);
        const { data } = await supabaseClient.from(table).select(columns).in('id', chunk);
        if (data) results = results.concat(data);
    }
    return results;
};

const fetchAllRows = async (buildQuery: () => any) => {
    let allData: any[] = [];
    let from = 0;
    const step = 999;
    while (true) {
        const query = buildQuery();
        const { data, error } = await query.range(from, from + step);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allData = allData.concat(data);
        if (data.length <= step) break;
        from += step + 1;
    }
    return allData;
};

const DEFAULT_PRIZES: SpinPrize[] = [
    { id: '678f1234-5678-4321-9876-000000000001', name: '5% Off – Next Visit', type: 'discount', value: 5, probabilityWeight: 20, isActive: true, color: '#B91c1c', createdAt: new Date().toISOString() }, // Tabarak Red
    { id: '678f1234-5678-4321-9876-000000000002', name: '7% Off Cosmetics', type: 'discount', value: 7, probabilityWeight: 15, isActive: true, color: '#0891b2', createdAt: new Date().toISOString() }, // Cyan-600
    { id: '678f1234-5678-4321-9876-000000000003', name: '7% Off Medical Devices', type: 'discount', value: 7, probabilityWeight: 15, isActive: true, color: '#f59e0b', createdAt: new Date().toISOString() }, // Amber-500
    { id: '678f1234-5678-4321-9876-000000000004', name: '7% Off Supplements', type: 'discount', value: 7, probabilityWeight: 15, isActive: true, color: '#B91c1c', createdAt: new Date().toISOString() }, // Tabarak Red
    { id: '678f1234-5678-4321-9876-000000000005', name: 'Free in Body (7 Days)', type: 'gift', value: 0, probabilityWeight: 20, isActive: true, color: '#0891b2', createdAt: new Date().toISOString() }, // Cyan-600
    { id: '678f1234-5678-4321-9876-000000000006', name: '3 BD Cashback (Min. 60 BD)', type: 'discount', value: 3, probabilityWeight: 15, isActive: true, color: '#f59e0b', createdAt: new Date().toISOString() }, // Amber-500
];

export const spinWinService = {
    prizes: {
        list: async () => {
            try {
                const { data, error } = await supabaseClient
                    .from('spin_prizes')
                    .select('*')
                    .order('created_at', { ascending: false });
                if (error) throw error;

                // Map snake_case to camelCase
                const prizes = (data || []).map(p => ({
                    id: p.id,
                    name: p.name,
                    type: p.type,
                    value: Number(p.value),
                    probabilityWeight: Number(p.probability_weight),
                    dailyLimit: p.daily_limit,
                    isActive: p.is_active,
                    color: p.color,
                    createdAt: p.created_at
                })) as SpinPrize[];

                if (prizes.length === 0) return isDemoMode ? DEFAULT_PRIZES : [];
                saveLocal(PRIZES_KEY, prizes);
                return prizes;
            } catch (err) {
                throwUnlessDemoMode(err);
                const local = getLocal<SpinPrize>(PRIZES_KEY);
                return local.length > 0 ? local : DEFAULT_PRIZES;
            }
        },
        create: async (prize: Omit<SpinPrize, 'id' | 'createdAt'>) => {
            try {
                const dbPrize = {
                    name: prize.name,
                    type: prize.type,
                    value: prize.value,
                    probability_weight: prize.probabilityWeight,
                    daily_limit: prize.dailyLimit,
                    is_active: prize.isActive,
                    color: prize.color
                };
                const { data, error } = await supabaseClient
                    .from('spin_prizes')
                    .insert([dbPrize])
                    .select()
                    .single();
                if (error) throw error;
                return data as SpinPrize;
            } catch (err) {
                throwUnlessDemoMode(err);
                const prizes = getLocal<SpinPrize>(PRIZES_KEY);
                const newPrize = { ...prize, id: generateUUID(), createdAt: new Date().toISOString() };
                prizes.push(newPrize);
                saveLocal(PRIZES_KEY, prizes);
                return newPrize as any;
            }
        },
        update: async (id: string, prize: Partial<SpinPrize>) => {
            try {
                // Map to snake_case
                const dbUpdate: any = {};
                if (prize.name !== undefined) dbUpdate.name = prize.name;
                if (prize.type !== undefined) dbUpdate.type = prize.type;
                if (prize.value !== undefined) dbUpdate.value = prize.value;
                if (prize.probabilityWeight !== undefined) dbUpdate.probability_weight = prize.probabilityWeight;
                if (prize.dailyLimit !== undefined) dbUpdate.daily_limit = prize.dailyLimit;
                if (prize.isActive !== undefined) dbUpdate.is_active = prize.isActive;
                if (prize.color !== undefined) dbUpdate.color = prize.color;

                const { data, error } = await supabaseClient
                    .from('spin_prizes')
                    .update(dbUpdate)
                    .eq('id', id)
                    .select()
                    .single();
                if (error) throw error;
                return data as SpinPrize;
            } catch (err) {
                throwUnlessDemoMode(err);
                const prizes = getLocal<SpinPrize>(PRIZES_KEY);
                const idx = prizes.findIndex(p => p.id === id);
                if (idx !== -1) {
                    prizes[idx] = { ...prizes[idx], ...prize };
                    saveLocal(PRIZES_KEY, prizes);
                }
                return prizes[idx];
            }
        },
        delete: async (id: string) => {
            try {
                const { error } = await supabaseClient
                    .from('spin_prizes')
                    .delete()
                    .eq('id', id);
                if (error) throw error;
            } catch (err) {
                throwUnlessDemoMode(err);
                const prizes = getLocal<SpinPrize>(PRIZES_KEY);
                saveLocal(PRIZES_KEY, prizes.filter(p => p.id !== id));
            }
        }
    },

    sessions: {
        generate: async (branchId: string, isMultiUse: boolean = false) => {
            try {
                const { data, error } = await supabaseClient.rpc('generate_spin_session', {
                    p_branch_id: branchId,
                    p_is_multi_use: isMultiUse
                });

                if (error) {
                    console.error('Session Generation RPC Failed:', error.message);
                    throw error;
                }

                if (!data || data.length === 0) throw new Error('No session returned from server');

                const result = data[0];

                return {
                    token: result.out_token,
                    branchId: branchId,
                    used: false,
                    isMultiUse: isMultiUse,
                    expiresAt: result.out_expires_at,
                    createdAt: result.out_created_at
                } as SpinSession;
            } catch (err: any) {
                console.error('Critical Failure in session generation:', err.message);
                throw new Error(`Database Sync Failed: ${err.message}`);
            }
        },
        validate: async (token: string) => {
            try {
                // Call the secure RPC
                const { data, error } = await supabaseClient.rpc('validate_spin_token', {
                    p_token: token
                });

                if (error) {
                    console.error('Supabase RPC Error:', error.message);
                    return null;
                }

                if (!data || data.length === 0) {
                    console.warn('Node returned no data mapping for token');
                    return null;
                }

                const result = data[0];
                if (!result.out_is_valid) {
                    console.error('Session Rejected by Security:', result.out_error_message);
                    return { error: result.out_error_message };
                }

                // Fetch extended branch details (Whatsapp, Map)
                const { data: branchDetails } = await supabaseClient
                    .from('branches')
                    .select('whatsapp_number, google_maps_link')
                    .eq('id', result.out_branch_id)
                    .single();

                return {
                    token: token,
                    branchId: result.out_branch_id,
                    isMultiUse: result.out_is_multi_use,
                    branches: {
                        name: result.out_branch_name,
                        google_maps_link: branchDetails?.google_maps_link || result.out_google_maps_link,
                        whatsapp_number: branchDetails?.whatsapp_number
                    }
                } as any;
            } catch (err) {
                console.error('Critical validation exception:', err);
                return null;
            }
        },
        markUsed: async (token: string) => {
            try {
                // First check if it's multi-use
                const { data } = await supabaseClient
                    .from('spin_sessions')
                    .select('is_multi_use')
                    .eq('token', token)
                    .single();

                if (data?.is_multi_use) return;

                const { error } = await supabaseClient
                    .from('spin_sessions')
                    .update({ used: true })
                    .eq('token', token);
                if (error) throw error;
            } catch (err) {
                throwUnlessDemoMode(err);
                const sessions = getLocal<SpinSession>(SESSIONS_KEY);
                const idx = sessions.findIndex(s => s.token === token);
                if (idx !== -1 && !sessions[idx].isMultiUse) {
                    sessions[idx].used = true;
                    saveLocal(SESSIONS_KEY, sessions);
                }
            }
        }
    },

    customers: {
        findByPhone: async (phone: string) => {
            try {
                const { data, error } = await supabaseClient
                    .from('customers')
                    .select('*')
                    .eq('phone', phone)
                    .maybeSingle();
                if (error) throw error;
                if (!data) return null;
                return {
                    id: data.id,
                    phone: data.phone,
                    firstName: data.first_name,
                    lastName: data.last_name,
                    email: data.email,
                    createdAt: data.created_at,
                    lastReviewedAt: data.last_reviewed_at
                } as Customer;
            } catch (err) {
                throwUnlessDemoMode(err);
                const customers = getLocal<Customer>(CUSTOMERS_KEY);
                return customers.find(c => c.phone === phone) || null;
            }
        },
        upsert: async (phone: string, email?: string, firstName?: string, lastName?: string) => {
            try {
                const payload = {
                    phone,
                    email: email || null,
                    first_name: firstName || null,
                    last_name: lastName || null
                };

                const { data, error } = await supabaseClient
                    .from('customers')
                    .upsert(payload, { onConflict: 'phone' })
                    .select()
                    .single();

                if (error) {
                    console.error('Customer Sync Error:', error.message);
                    throw error;
                }

                return {
                    id: data.id,
                    phone: data.phone,
                    firstName: data.first_name,
                    lastName: data.last_name,
                    email: data.email,
                    createdAt: data.created_at
                } as Customer;
            } catch (err) {
                throwUnlessDemoMode(err);
                console.warn('DB Sync failed, using demo local backup');
                const customers = getLocal<Customer>(CUSTOMERS_KEY);
                let customer = customers.find(c => c.phone === phone);
                if (!customer) {
                    customer = {
                        id: generateUUID(), // Essential: Must be valid UUID for foreign key
                        phone,
                        email,
                        firstName,
                        lastName,
                        createdAt: new Date().toISOString()
                    };
                    customers.push(customer);
                    saveLocal(CUSTOMERS_KEY, customers);
                }
                return customer;
            }
        }
    },

    spins: {
        play: async (token: string, customerInfo: { phone: string, firstName: string, lastName: string, email: string }) => {
            try {
                // EXECUTING ATOMIC BACKEND TRANSACTION
                const { data, error } = await supabaseClient.rpc('execute_spin_transaction', {
                    p_token: token,
                    p_phone: customerInfo.phone,
                    p_first_name: customerInfo.firstName,
                    p_last_name: customerInfo.lastName,
                    p_email: customerInfo.email,
                    // Backwards-compatible RPC argument. Fraud limits are computed
                    // server-side from customers/spins, not from client IP data.
                    p_ip_address: null
                });

                if (error) {
                    console.error('Spin Execution Failed:', error);
                    throw error;
                }

                const result = data[0];
                return {
                    spinId: result.spin_id,
                    voucherCode: result.voucher_code,
                    prize: {
                        id: result.prize_id,
                        name: result.prize_name,
                        type: result.prize_type,
                        value: 0 // Defaulted to 0 as value is deprecated
                    }
                };
            } catch (err: any) {
                console.error('Production spin failed:', err.message);
                throw err;
            }
        },
        list: async (filters: { branchId?: string, startDate?: string, endDate?: string } = {}) => {
            try {
                const buildQuery = () => {
                    let query = supabaseClient.from('spins').select('id, customer_id, branch_id, prize_id, voucher_code, redeemed_at, created_at, redeemed_branch_id');

                    if (filters.branchId) {
                        // Show if created in this branch OR redeemed in this branch
                        query = query.or(`branch_id.eq.${filters.branchId},redeemed_branch_id.eq.${filters.branchId}`);
                    }

                    if (filters.startDate) query = query.gte('created_at', filters.startDate);
                    if (filters.endDate) query = query.lte('created_at', filters.endDate + 'T23:59:59');

                    return query.order('created_at', { ascending: false });
                };

                const spins = await fetchAllRows(buildQuery);

                // Manual enrichment fallback using chunked fetch to bypass 1000 row limits
                const [customers, prizes, branches] = await Promise.all([
                    fetchEnrichmentData('customers', 'id, phone, first_name', (spins || []).map(s => s.customer_id)),
                    fetchEnrichmentData('spin_prizes', 'id, name', (spins || []).map(s => s.prize_id)),
                    fetchEnrichmentData('branches', 'id, name', (spins || []).map(s => s.branch_id).concat((spins || []).map(s => s.redeemed_branch_id)))
                ]);

                const enriched = (spins || []).map(s => ({
                    ...s,
                    customer: customers.find(x => x.id === s.customer_id),
                    prize: prizes.find(x => x.id === s.prize_id),
                    branch: branches.find(x => x.id === s.branch_id),
                    redeemed_branch: branches.find(x => x.id === s.redeemed_branch_id),
                    voucher_code: s.voucher_code
                }));

                return enriched;
            } catch (err) {
                throwUnlessDemoMode(err);
                console.error('Spins list fetch failed:', err);
                return getLocal(SPINS_KEY);
            }
        },
        getDailyCount: async (identifier: string, type: 'ip' | 'customer' = 'customer') => {
            try {
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                let query = supabaseClient
                    .from('spins')
                    .select('*', { count: 'exact', head: true })
                    .gte('created_at', today.toISOString());

                if (type === 'ip') {
                    query = query.eq('ip_address', identifier);
                } else {
                    query = query.eq('customer_id', identifier);
                }

                const { count, error } = await query;
                if (error) throw error;
                return count || 0;
            } catch (err) {
                throwUnlessDemoMode(err);
                // Demo fallback only; production fraud/rate checks must run server-side.
                const today = new Date().toISOString().split('T')[0];
                const spins = getLocal<Spin>(SPINS_KEY);
                return spins.filter(s => s.customerId === identifier && s.createdAt.startsWith(today)).length;
            }
        },
        getBranchStats: async (branchId: string, startDate?: string, endDate?: string) => {
            try {
                // Default to Today if NO dates provided at all
                // If startDate is "" (empty string), it means 'All Time', so we skip the default
                let start = startDate;
                let end = endDate;

                if (start === undefined) {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    start = today.toISOString();
                }

                const buildSpinQuery = () => {
                    let spinQuery = supabaseClient
                        .from('spins')
                        .select('id, customer_id, prize_id, voucher_code, created_at')
                        .eq('branch_id', branchId);

                    if (start && start.trim() !== '') {
                        spinQuery = spinQuery.gte('created_at', start);
                    }

                    if (end && end.trim() !== '') {
                        spinQuery = spinQuery.lte('created_at', end + 'T23:59:59');
                    }
                    
                    return spinQuery;
                };

                const buildRedeemQuery = () => {
                    let redeemQuery = supabaseClient
                        .from('spins')
                        .select('id')
                        .eq('redeemed_branch_id', branchId);

                    if (start && start.trim() !== '') {
                        redeemQuery = redeemQuery.gte('redeemed_at', start);
                    }

                    if (end && end.trim() !== '') {
                        redeemQuery = redeemQuery.lte('redeemed_at', end + 'T23:59:59');
                    }
                    
                    return redeemQuery;
                };

                const [spinsToday, redeemsToday] = await Promise.all([
                    fetchAllRows(buildSpinQuery),
                    fetchAllRows(buildRedeemQuery)
                ]);

                // Enrich manually using chunked fetch to avoid 1000 rows limits
                const [customers, prizes] = await Promise.all([
                    fetchEnrichmentData('customers', 'id, phone, first_name', (spinsToday || []).map(s => s.customer_id)),
                    fetchEnrichmentData('spin_prizes', 'id, name', (spinsToday || []).map(s => s.prize_id))
                ]);

                const normalized = (spinsToday || []).map(s => ({
                    ...s,
                    customer: customers.find(x => x.id === s.customer_id),
                    prize: prizes.find(x => x.id === s.prize_id),
                    voucher_code: s.voucher_code
                }));

                return {
                    spins: normalized,
                    redeemsCount: redeemsToday?.length || 0,
                    uniqueCustomersToday: new Set(normalized.map(s => s.customer_id)).size
                };
            } catch (err) {
                console.error('getBranchStats failed:', err);
                return { spins: [], redeemsCount: 0, uniqueCustomersToday: 0 };
            }
        },
        getGlobalStats: async () => {
            try {
                const buildQuery = () => supabaseClient
                    .from('spins')
                    .select('id, customer_id, prize_id, branch_id, voucher_code, redeemed_at, created_at');

                const spins = await fetchAllRows(buildQuery);

                const [customers, prizes, branches] = await Promise.all([
                    fetchEnrichmentData('customers', 'id, first_name, phone', (spins || []).map(s => s.customer_id)),
                    fetchEnrichmentData('spin_prizes', 'id, name', (spins || []).map(s => s.prize_id)),
                    fetchEnrichmentData('branches', 'id, name', (spins || []).map(s => s.branch_id))
                ]);

                const enriched = (spins || []).map(s => ({
                    ...s,
                    customer: customers.find(x => x.id === s.customer_id),
                    prize: prizes.find(x => x.id === s.prize_id),
                    branch: branches.find(x => x.id === s.branch_id),
                    voucher_code: s.voucher_code
                }));

                const prizePopularity: any = {};
                enriched.forEach(s => {
                    const name = s.prize?.name || 'Unknown';
                    prizePopularity[name] = (prizePopularity[name] || 0) + 1;
                });

                return {
                    totalSpins: enriched.length,
                    prizePopularity,
                    allSpins: enriched
                };
            } catch (err) {
                console.error('getGlobalStats failed:', err);
                return { totalSpins: 0, prizePopularity: {}, allSpins: [] };
            }
        }
    },

    vouchers: {
        find: async (code: string) => {
            try {
                const cleanCode = code.trim().toUpperCase();
                // Safe lookup: try exact match first
                let { data: spin, error } = await supabaseClient
                    .from('spins')
                    .select('*')
                    .eq('voucher_code', cleanCode)
                    .maybeSingle();

                // Advanced lookup: if not found, try searching with partial match (LIKE)
                if (!spin) {
                    const query = await supabaseClient
                        .from('spins')
                        .select('*')
                        .ilike('voucher_code', `%${cleanCode.replace('VOUCH-', '')}%`)
                        .maybeSingle();
                    spin = query.data;
                }

                if (!spin) return null;

                const [customer, prize, branch] = await Promise.all([
                    supabaseClient.from('customers').select('*').eq('id', spin.customer_id).maybeSingle(),
                    supabaseClient.from('spin_prizes').select('*').eq('id', spin.prize_id).maybeSingle(),
                    supabaseClient
                        .from('branches')
                        .select('id, code, name, role, google_maps_link, whatsapp_number, is_spin_enabled')
                        .eq('id', spin.branch_id)
                        .maybeSingle()
                ]);

                return {
                    ...spin,
                    customer: customer.data,
                    prize: prize.data,
                    branch: branch.data,
                    voucher_code: spin.voucher_code
                };
            } catch (err) {
                console.error('vouchers.find failed:', err);
                return null;
            }
        },
        redeem: async (id: string, branchId: string) => {
            const { error } = await supabaseClient.rpc('redeem_spin_voucher', {
                p_spin_id: id,
                p_branch_id: branchId
            });
            if (error) throw error;
            return true;
        }
    },

    reviews: {
        log: async (review: Omit<BranchReview, 'id' | 'reviewedAt'>) => {
            try {
                // Map to snake_case for DB
                const dbReview = {
                    customer_id: review.customerId,
                    branch_id: review.branchId,
                    review_clicked: review.reviewClicked
                };
                const { data, error } = await supabaseClient
                    .from('branch_reviews')
                    .insert([dbReview])
                    .select()
                    .single();
                if (error) throw error;
                return data as BranchReview;
            } catch (err) {
                throwUnlessDemoMode(err);
                console.error('Database review log failed', err);
                return { ...review, id: generateUUID(), reviewedAt: new Date().toISOString() } as any;
            }
        },
        checkToday: async (customerId: string, branchId: string) => {
            try {
                const today = new Date().toISOString().split('T')[0];
                const { data, error } = await supabaseClient
                    .from('branch_reviews')
                    .select('*')
                    .eq('customer_id', customerId)
                    .eq('branch_id', branchId)
                    .gte('reviewed_at', today)
                    .maybeSingle();
                if (error) throw error;
                return data as BranchReview | null;
            } catch (err) {
                return null; // Assume not reviewed if offline and can't find local log
            }
        }
    },

    shares: {
        log: async (share: { voucherCode: string, fromCustomerId: string, branchId: string }) => {
            try {
                const dbShare = {
                    voucher_code: share.voucherCode,
                    from_customer_id: share.fromCustomerId,
                    branch_id: share.branchId
                };
                const { error } = await supabaseClient.from('voucher_shares').insert([dbShare]);
                if (error) throw error;
                return true;
            } catch (err) {
                console.error('Share log failed', err);
                return false;
            }
        }
    },

    management: {
        branches: {
            list: async () => {
                const { data, error } = await supabaseClient
                    .from('branches')
                    .select('id, code, name, role, google_maps_link, is_spin_enabled, whatsapp_number')
                    .order('name', { ascending: true });
                if (error) throw error;
                return data.map(b => ({
                    id: b.id,
                    code: b.code,
                    name: b.name,
                    role: b.role,
                    googleMapsLink: b.google_maps_link,
                    isSpinEnabled: b.is_spin_enabled,
                    whatsappNumber: b.whatsapp_number
                })) as Branch[];
            },
            update: async (id: string, updates: Partial<Branch>) => {
                // Map to snake_case for DB
                const dbUpdates: any = {};
                if (updates.name) dbUpdates.name = updates.name;
                if (updates.googleMapsLink !== undefined) dbUpdates.google_maps_link = updates.googleMapsLink;
                if (updates.isSpinEnabled !== undefined) {
                    dbUpdates.is_spin_enabled = updates.isSpinEnabled;
                }
                if (updates.whatsappNumber !== undefined) dbUpdates.whatsapp_number = updates.whatsappNumber;

                // Note: RLS policy may not allow SELECT after UPDATE
                // We just check for errors - if no error, update succeeded
                const { error } = await supabaseClient
                    .from('branches')
                    .update(dbUpdates)
                    .eq('id', id);

                if (error) {
                    console.error(`❌ Database update failed for branch ${id}:`, error);
                    throw error;
                }

                return true;
            },
            create: async (branch: Pick<Branch, 'name' | 'code' | 'role' | 'whatsappNumber' | 'googleMapsLink'>) => {
                const dbBranch = {
                    name: branch.name,
                    code: branch.code,
                    role: branch.role || 'branch',
                    whatsapp_number: branch.whatsappNumber,
                    google_maps_link: branch.googleMapsLink,
                    is_spin_enabled: true
                };

                const { data, error } = await supabaseClient
                    .from('branches')
                    .insert([dbBranch])
                    .select()
                    .single();

                if (error) throw error;
                return data;
            }
        }
    }
};
