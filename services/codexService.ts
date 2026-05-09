import { supabaseClient } from '../lib/supabase';
import { CodexEntry } from '../types';

export const codexService = {
  list: async (): Promise<CodexEntry[]> => {
    const { data, error } = await supabaseClient.from('corporate_codex').select('*').order('publish_date', { ascending: false });
    if (error) return [];
    return data.map(d => ({
      id: d.id, title: d.title, description: d.description, type: d.type,
      priority: d.priority || 'normal', publishDate: d.publish_date, pages: d.pages || [],
      isPublished: d.is_published, isPinned: d.is_pinned, department: d.department,
      tags: d.tags || [], createdAt: d.created_at, updatedAt: d.updated_at
    }));
  },
  upsert: async (entry: Partial<CodexEntry>) => {
    const payload = {
      title: entry.title, description: entry.description, type: entry.type,
      priority: entry.priority, publish_date: entry.publishDate, pages: entry.pages,
      is_published: entry.isPublished ?? true, is_pinned: entry.isPinned ?? false,
      department: entry.department ?? 'all', tags: entry.tags ?? []
    };
    if (entry.id) {
      const { data, error } = await supabaseClient.from('corporate_codex').update(payload).eq('id', entry.id).select();
      if (error) throw error;
      return data[0];
    } else {
      const { data, error } = await supabaseClient.from('corporate_codex').insert([payload]).select();
      if (error) throw error;
      return data[0];
    }
  },
  delete: async (id: string) => {
    const { error } = await supabaseClient.from('corporate_codex').delete().eq('id', id);
    if (error) throw error;
    return true;
  },
  acknowledgments: {
    list: async (entryId?: string) => {
      let query = supabaseClient.from('corporate_codex_acknowledgments').select('*');
      if (entryId) query = query.eq('entry_id', entryId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    upsert: async (ack: { entry_id: string; user_id: string; user_name: string }) => {
      const { data, error } = await supabaseClient
        .from('corporate_codex_acknowledgments')
        .upsert([ack], { onConflict: 'entry_id,user_id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    }
  }
};
