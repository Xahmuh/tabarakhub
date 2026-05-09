import { supabaseClient } from '../lib/supabase';
import { EmployeeContribution, ContributionType } from '../types';

export const contributionService = {
  list: async (): Promise<EmployeeContribution[]> => {
    const { data, error } = await supabaseClient
      .from('employee_contributions')
      .select('*')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });
      
    if (error) {
      console.error('Error fetching contributions:', error);
      return [];
    }
    
    return data.map(d => ({
      id: d.id,
      title: d.title,
      description: d.description,
      type: d.type as ContributionType,
      url: d.url,
      createdBy: d.created_by,
      branch: d.branch,
      tags: d.tags || [],
      thumbnail: d.thumbnail,
      isPinned: d.is_pinned,
      isArchived: d.is_archived,
      createdAt: d.created_at
    }));
  },

  upsert: async (contribution: Partial<EmployeeContribution>) => {
    const payload = {
      title: contribution.title,
      description: contribution.description,
      type: contribution.type,
      url: contribution.url,
      created_by: contribution.createdBy,
      branch: contribution.branch,
      tags: contribution.tags || [],
      thumbnail: contribution.thumbnail,
      is_pinned: contribution.isPinned ?? false,
      is_archived: contribution.isArchived ?? false,
    };

    if (contribution.id) {
      const { data, error } = await supabaseClient
        .from('employee_contributions')
        .update(payload)
        .eq('id', contribution.id)
        .select();
      if (error) {
        console.error('Error updating contribution:', error);
        throw error;
      }
      return data[0];
    } else {
      const { data, error } = await supabaseClient
        .from('employee_contributions')
        .insert([payload])
        .select();
      if (error) {
        console.error('Error inserting contribution:', error);
        throw error;
      }
      return data[0];
    }
  },

  delete: async (id: string) => {
    const { error } = await supabaseClient
      .from('employee_contributions')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  },

  togglePin: async (id: string, isPinned: boolean) => {
    const { error } = await supabaseClient
      .from('employee_contributions')
      .update({ is_pinned: isPinned })
      .eq('id', id);
    if (error) throw error;
    return true;
  },

  toggleArchive: async (id: string, isArchived: boolean) => {
    const { error } = await supabaseClient
      .from('employee_contributions')
      .update({ is_archived: isArchived })
      .eq('id', id);
    if (error) throw error;
    return true;
  }
};
