import { supabaseClient } from '../lib/supabase';
import { EmployeeContribution, ContributionType } from '../types';
import { generateUUID } from '../utils/uuid';

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
      filePath: d.file_path,
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
      file_path: contribution.filePath,
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
  },

  uploadFile: async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const safeOriginalName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${generateUUID()}_${safeOriginalName}`;
    const filePath = `files/${fileName}`;

    const { error: uploadError } = await supabaseClient.storage
      .from('contributions')
      .upload(filePath, file);

    if (uploadError) {
      console.error('Error uploading file:', uploadError);
      throw uploadError;
    }

    const { data: { publicUrl } } = supabaseClient.storage
      .from('contributions')
      .getPublicUrl(filePath);

    return publicUrl;
  },

  downloadFile: async (url: string, title: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      // Extract original filename or create one from title
      const urlParts = url.split('/');
      let fileName = urlParts[urlParts.length - 1];
      
      // If it's our new format (UUID_OriginalName), extract the original part
      if (fileName && fileName.includes('_') && fileName.length > 36) {
        const parts = fileName.split('_');
        // Check if the first part looks like a UUID (approximate check)
        if (parts[0].length === 36) {
          fileName = parts.slice(1).join('_');
        }
      }
      
      if (!fileName) fileName = title.replace(/\s+/g, '_');
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download error:', error);
      // Fallback: open in new tab if blob download fails
      window.open(url, '_blank');
    }
  }
};
