import React, { useState, useEffect } from 'react';
import { X, Plus, Tag as TagIcon, Link as LinkIcon, Info, Sparkles, CheckCircle2, Loader2 } from 'lucide-react';
import { contributionService } from '../../../services/contributionService';
import { EmployeeContribution, ContributionType } from '../../../types';
import Swal from 'sweetalert2';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingContribution?: EmployeeContribution;
  branchCode?: string;
}

const CONTRIBUTION_TYPES: ContributionType[] = [
  'Tool', 'Automation', 'Dashboard', 'SOP', 'Training', 'Project', 'Link', 'AI Prompt'
];

export const AddContributionModal: React.FC<Props> = ({ 
  isOpen, 
  onClose, 
  onSuccess, 
  editingContribution,
  branchCode 
}) => {
  const [formData, setFormData] = useState<Partial<EmployeeContribution>>({
    title: '',
    description: '',
    type: 'Tool',
    url: '',
    tags: [],
    isPinned: false,
    branch: branchCode || '',
    createdBy: 'Manager'
  });

  const [tagInput, setTagInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    if (editingContribution) {
      setFormData(editingContribution);
    } else {
      setFormData({
        title: '',
        description: '',
        type: 'Tool',
        url: '',
        tags: [],
        isPinned: false,
        branch: branchCode || '',
        createdBy: 'Manager'
      });
    }
  }, [editingContribution, isOpen, branchCode]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.type) {
      Swal.fire('Validation Error', 'Please fill in all required fields.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      let finalData = { ...formData };
      
      // Handle file upload if present
      if (selectedFile) {
        const fileUrl = await contributionService.uploadFile(selectedFile);
        finalData.filePath = fileUrl;
      }

      await contributionService.upsert(finalData);
      Swal.fire({
        title: editingContribution ? 'Updated!' : 'Created!',
        text: editingContribution ? 'Contribution has been updated.' : 'New contribution added successfully.',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false
      });
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error saving contribution:', err);
      Swal.fire('Error', 'Failed to save contribution. Please check your database connection and storage policies.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const addTag = () => {
    const tag = tagInput.trim().toUpperCase();
    if (tag && !formData.tags?.includes(tag)) {
      setFormData(prev => ({ ...prev, tags: [...(prev.tags || []), tag] }));
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setFormData(prev => ({ ...prev, tags: (prev.tags || []).filter(t => t !== tag) }));
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity" onClick={onClose} />
      
      <div className="relative bg-white w-full max-w-xl rounded-[32px] shadow-2xl shadow-slate-900/40 overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="bg-slate-50 px-8 py-6 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-brand rounded-xl flex items-center justify-center text-white shadow-lg shadow-brand/20">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                {editingContribution ? 'Edit Contribution' : 'New Contribution'}
              </h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">Enterprise Resource</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2.5 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto max-h-[70vh]">
          {/* Basic Info */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1 flex items-center">
                  Title <span className="text-red-500 ml-1">*</span>
                </label>
                <input 
                  required
                  type="text" 
                  placeholder="e.g. Sales Automation Script"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium outline-none focus:border-brand focus:ring-4 focus:ring-brand/5 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Type</label>
                <select 
                  value={formData.type}
                  title="Contribution Type"
                  onChange={(e) => setFormData({...formData, type: e.target.value as ContributionType})}
                  className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium outline-none focus:border-brand transition-all"
                >
                  {CONTRIBUTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Description</label>
              <textarea 
                placeholder="How does this tool help our pharmacists?"
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium outline-none focus:border-brand focus:ring-4 focus:ring-brand/5 transition-all resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1 flex items-center">
                URL / Resource Link <LinkIcon className="w-3 h-3 ml-2 text-slate-400" />
              </label>
              <input 
                type="url" 
                placeholder="https://docs.google.com/..."
                value={formData.url}
                onChange={(e) => setFormData({...formData, url: e.target.value})}
                className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium outline-none focus:border-brand transition-all"
              />
            </div>

            {/* File Upload */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1 flex items-center">
                Upload File (.exe, .pdf, .zip, etc.) <Plus className="w-3 h-3 ml-2 text-slate-400" />
              </label>
              <div className="relative group">
                <input 
                  type="file" 
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="hidden"
                  id="contribution-file"
                />
                <label 
                  htmlFor="contribution-file"
                  className="w-full flex items-center justify-between px-5 py-3 bg-slate-50 border border-slate-200 border-dashed rounded-2xl text-sm font-medium cursor-pointer hover:border-brand hover:bg-brand/[0.02] transition-all"
                >
                  <span className="text-slate-500 truncate max-w-[200px]">
                    {selectedFile ? selectedFile.name : (formData.filePath ? 'Change existing file' : 'Select file to upload...')}
                  </span>
                  <div className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-400 uppercase tracking-wider group-hover:text-brand group-hover:border-brand/20 transition-all">
                    Browse
                  </div>
                </label>
                {selectedFile && (
                  <button 
                    type="button"
                    onClick={() => setSelectedFile(null)}
                    className="absolute -right-2 -top-2 w-6 h-6 bg-red-100 text-red-500 rounded-full flex items-center justify-center hover:bg-red-200 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1 flex items-center">
              Tags <TagIcon className="w-3 h-3 ml-2 text-slate-400" />
            </label>
            <div className="flex space-x-2">
              <input 
                type="text" 
                placeholder="Add tag (e.g. EXCEL, AI)"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                className="flex-1 px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium outline-none focus:border-brand transition-all"
              />
              <button 
                type="button" 
                onClick={addTag}
                className="px-6 bg-slate-900 text-white rounded-2xl font-bold text-xs hover:bg-slate-800 transition-all"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              {formData.tags?.map(tag => (
                <span key={tag} className="flex items-center space-x-1.5 px-3 py-1.5 bg-brand/5 text-brand rounded-xl text-[10px] font-black uppercase tracking-wider border border-brand/10">
                  <span>{tag}</span>
                  <button type="button" onClick={() => removeTag(tag)} className="hover:text-red-500 transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Settings */}
          <div className="flex items-center justify-between p-4 bg-amber-50/50 rounded-2xl border border-amber-200/40">
            <div className="flex items-center space-x-3">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <div>
                <p className="text-sm font-bold text-slate-900">Featured Resource</p>
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Pin this to the top of the hub</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setFormData({...formData, isPinned: !formData.isPinned})}
              className={`w-12 h-6 rounded-full transition-all relative ${formData.isPinned ? 'bg-amber-500' : 'bg-slate-200'}`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${formData.isPinned ? 'left-7' : 'left-1'}`} />
            </button>
          </div>
        </form>

        {/* Actions */}
        <div className="p-8 pt-0 flex items-center space-x-3">
          <button 
            type="button"
            onClick={onClose}
            className="flex-1 px-8 py-4 bg-slate-50 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-100 transition-all"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-[2] px-8 py-4 bg-brand text-white rounded-2xl font-bold text-sm shadow-xl shadow-brand/20 hover:bg-brand/90 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            {isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                <span>{editingContribution ? 'Save Changes' : 'Create Resource'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
