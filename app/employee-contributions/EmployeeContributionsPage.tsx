import React, { useState, useEffect } from 'react';
import { 
  Lightbulb, Search, Plus, Pin
} from 'lucide-react';
import { contributionService } from '../../services/contributionService';
import { EmployeeContribution, ContributionType } from '../../types';
import { ContributionCard, AddContributionModal } from './components';
import Swal from 'sweetalert2';

interface Props {
  userRole?: string;
  branchCode?: string;
  onBack?: () => void;
}

export const EmployeeContributionsPage: React.FC<Props> = ({ userRole, branchCode, onBack }) => {
  const [contributions, setContributions] = useState<EmployeeContribution[]>([]);
  const [filteredContributions, setFilteredContributions] = useState<EmployeeContribution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContribution, setEditingContribution] = useState<EmployeeContribution | undefined>();
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<ContributionType | 'All'>('All');
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<'All' | string>('All');

  const isManager = userRole === 'admin' || userRole === 'manager' || userRole === 'master';

  const loadData = async () => {
    setIsLoading(true);
    const data = await contributionService.list();
    setContributions(data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    let result = contributions.filter(c => !c.isArchived);

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c => 
        c.title.toLowerCase().includes(q) || 
        c.description?.toLowerCase().includes(q) ||
        c.tags?.some(t => t.toLowerCase().includes(q))
      );
    }

    if (selectedType !== 'All') {
      result = result.filter(c => c.type === selectedType);
    }

    if (showPinnedOnly) {
      result = result.filter(c => c.isPinned);
    }

    if (selectedBranch !== 'All') {
      result = result.filter(c => c.branch === selectedBranch);
    }

    setFilteredContributions(result);
  }, [contributions, searchQuery, selectedType, showPinnedOnly, selectedBranch]);

  const handleDelete = async (id: string) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: "You won't be able to revert this!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, delete it!'
    });

    if (result.isConfirmed) {
      try {
        await contributionService.delete(id);
        setContributions(prev => prev.filter(c => c.id !== id));
        Swal.fire('Deleted!', 'Contribution has been deleted.', 'success');
      } catch (err) {
        Swal.fire('Error', 'Failed to delete contribution', 'error');
      }
    }
  };

  const handleTogglePin = async (id: string, currentStatus: boolean) => {
    try {
      await contributionService.togglePin(id, !currentStatus);
      setContributions(prev => prev.map(c => c.id === id ? { ...c, isPinned: !currentStatus } : c));
    } catch (err) {
      Swal.fire('Error', 'Failed to update pin status', 'error');
    }
  };

  const handleEdit = (contribution: EmployeeContribution) => {
    setEditingContribution(contribution);
    setIsModalOpen(true);
  };

  const handleDownload = async (url: string, title: string) => {
    try {
      await contributionService.downloadFile(url, title);
    } catch (err) {
      Swal.fire('Error', 'Failed to download file', 'error');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-32">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-brand/10 rounded-2xl flex items-center justify-center text-brand">
              <Lightbulb className="w-6 h-6" />
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter">Team Contributions</h1>
          </div>
          <p className="text-slate-500 font-medium max-w-2xl">
            Shared tools, automations, projects, and useful resources created by employees across all branches.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {isManager && (
            <button 
              onClick={() => {
                setEditingContribution(undefined);
                setIsModalOpen(true);
              }}
              className="flex items-center space-x-2 px-6 py-3 bg-brand text-white rounded-xl font-bold text-sm shadow-lg shadow-brand/20 hover:bg-brand/90 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Add Contribution</span>
            </button>
          )}
          {onBack && (
            <button 
              onClick={onBack}
              className="px-6 py-3 bg-white border border-slate-200 rounded-xl text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all"
            >
              Back to Suite
            </button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm space-y-4 md:space-y-0 md:flex md:items-center md:space-x-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search tools, projects, tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-brand focus:ring-4 focus:ring-brand/5 outline-none transition-all font-medium"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
            {(['All', 'Tool', 'Automation', 'Dashboard', 'SOP', 'Link'] as const).map(type => (
              <button
                key={type}
                onClick={() => setSelectedType(type as any)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${selectedType === type ? 'bg-white text-brand shadow-sm ring-1 ring-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {type}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowPinnedOnly(!showPinnedOnly)}
            className={`flex items-center space-x-2 px-4 py-3 rounded-xl border font-bold text-xs transition-all ${showPinnedOnly ? 'bg-amber-50 border-amber-200 text-amber-600 shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
          >
            <Pin className={`w-3.5 h-3.5 ${showPinnedOnly ? 'fill-amber-600' : ''}`} />
            <span>Pinned Only</span>
          </button>
        </div>
      </div>

      {/* Content Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-64 bg-slate-100 rounded-3xl animate-pulse"></div>
          ))}
        </div>
      ) : filteredContributions.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {filteredContributions.map(contribution => (
            <ContributionCard 
              key={contribution.id} 
              contribution={contribution} 
              isManager={isManager}
              onEdit={() => handleEdit(contribution)}
              onDelete={() => handleDelete(contribution.id)}
              onTogglePin={() => handleTogglePin(contribution.id, contribution.isPinned)}
              onDownload={handleDownload}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-[32px] p-20 text-center space-y-6">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
            <Search className="w-10 h-10 text-slate-300" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-black text-slate-900">No contributions found</h3>
            <p className="text-slate-400 font-medium max-w-sm mx-auto">
              We couldn't find any resources matching your current filters. Try adjusting your search or category.
            </p>
          </div>
          <button 
            onClick={() => {
              setSearchQuery('');
              setSelectedType('All');
              setShowPinnedOnly(false);
            }}
            className="text-brand font-bold text-sm hover:underline"
          >
            Clear all filters
          </button>
        </div>
      )}

      {/* Modals */}
      <AddContributionModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={loadData}
        editingContribution={editingContribution}
        branchCode={branchCode}
      />
    </div>
  );
};
