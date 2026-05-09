import React from 'react';
import { 
  Pin, Edit2, Trash2, ExternalLink, Calendar, User, 
  MapPin, Tag, Wrench, Layout, Link as LinkIcon, 
  BookOpen, FileText, Cpu, Sparkles, MessageSquare, 
  CheckCircle2, Clock, MoreVertical, Download,
  Rocket, GraduationCap, FileCheck2, BarChart3, 
  Zap, BrainCircuit, Globe, Terminal, Briefcase,
  ShieldCheck, Bot, Sparkle
} from 'lucide-react';
import { EmployeeContribution, ContributionType } from '../../../types';

interface Props {
  contribution: EmployeeContribution;
  isManager: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  onDownload: (url: string, title: string) => void;
}

const typeConfigs: Record<ContributionType, { icon: any; color: string; bgColor: string; glowColor: string }> = {
  'Tool': { icon: Terminal, color: 'text-blue-600', bgColor: 'bg-blue-50/50', glowColor: 'group-hover:shadow-blue-200/50' },
  'Project': { icon: Rocket, color: 'text-indigo-600', bgColor: 'bg-indigo-50/50', glowColor: 'group-hover:shadow-indigo-200/50' },
  'Link': { icon: Globe, color: 'text-sky-600', bgColor: 'bg-sky-50/50', glowColor: 'group-hover:shadow-sky-200/50' },
  'Training': { icon: GraduationCap, color: 'text-emerald-600', bgColor: 'bg-emerald-50/50', glowColor: 'group-hover:shadow-emerald-200/50' },
  'SOP': { icon: ShieldCheck, color: 'text-orange-600', bgColor: 'bg-orange-50/50', glowColor: 'group-hover:shadow-orange-200/50' },
  'Dashboard': { icon: BarChart3, color: 'text-purple-600', bgColor: 'bg-purple-50/50', glowColor: 'group-hover:shadow-purple-200/50' },
  'Automation': { icon: Zap, color: 'text-amber-600', bgColor: 'bg-amber-50/50', glowColor: 'group-hover:shadow-amber-200/50' },
  'AI Prompt': { icon: BrainCircuit, color: 'text-rose-600', bgColor: 'bg-rose-50/50', glowColor: 'group-hover:shadow-rose-200/50' },
};

export const ContributionCard: React.FC<Props> = ({ 
  contribution, 
  isManager, 
  onEdit, 
  onDelete, 
  onTogglePin,
  onDownload
}) => {
  const config = typeConfigs[contribution.type] || typeConfigs['Tool'];
  const Icon = config.icon;

  return (
    <div className={`group relative bg-white border border-slate-200/60 rounded-3xl p-6 transition-all duration-500 hover:shadow-2xl hover:shadow-slate-200/50 hover:border-brand/20 flex flex-col h-full ${contribution.isPinned ? 'ring-2 ring-amber-400/30' : ''}`}>
      {/* Top Bar */}
      <div className="flex items-start justify-between mb-5">
        <div className={`w-12 h-12 ${config.bgColor} ${config.color} rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 shadow-sm border border-white/50 backdrop-blur-sm ${config.glowColor} group-hover:shadow-xl`}>
          <Icon className="w-6 h-6" strokeWidth={2.5} />
        </div>
        
        <div className="flex items-center space-x-1">
          {contribution.isPinned && (
            <div className="bg-amber-100 text-amber-600 p-2 rounded-xl shadow-sm" title="Pinned Contribution">
              <Pin className="w-3.5 h-3.5 fill-amber-600" />
            </div>
          )}
          
          {isManager && (
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center bg-white/80 backdrop-blur-md border border-slate-200 rounded-xl p-1 shadow-sm ml-2">
              <button onClick={onTogglePin} className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-colors" title={contribution.isPinned ? "Unpin" : "Pin"}>
                <Pin className={`w-3.5 h-3.5 ${contribution.isPinned ? 'fill-amber-500 text-amber-500' : ''}`} />
              </button>
              <button onClick={onEdit} className="p-2 text-slate-400 hover:text-brand hover:bg-brand/5 rounded-lg transition-colors" title="Edit">
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button onClick={onDelete} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="space-y-3 flex-1">
        <div className="flex items-center space-x-2">
          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${config.bgColor} ${config.color} border border-current/10 shadow-sm`}>
            {contribution.type}
          </span>
          <span className="flex items-center space-x-1.5 px-2 py-1 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest rounded-lg border border-slate-100">
            <MapPin className="w-3 h-3 text-slate-300" />
            <span>{contribution.branch}</span>
          </span>
        </div>
        
        <h3 className="text-xl font-black text-slate-900 tracking-tight leading-tight group-hover:text-brand transition-colors line-clamp-2 pt-1">
          {contribution.title}
        </h3>
        
        <p className="text-sm font-medium text-slate-500 leading-relaxed line-clamp-3">
          {contribution.description}
        </p>

        {contribution.tags && contribution.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {contribution.tags.map(tag => (
              <span key={tag} className="flex items-center space-x-1 px-2.5 py-1 bg-slate-50/50 text-slate-500 rounded-lg text-[9px] font-black border border-slate-100/80 uppercase tracking-wider hover:bg-white hover:border-slate-200 transition-colors cursor-default">
                <Tag className="w-2.5 h-2.5 text-slate-300" />
                <span>{tag}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="mt-8 pt-5 border-t border-slate-100/80 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl flex items-center justify-center text-slate-400 border border-slate-200 shadow-sm">
            <User className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-900 leading-none truncate max-w-[100px]">
              {contribution.createdBy}
            </span>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1 flex items-center">
              <Clock className="w-2.5 h-2.5 mr-1 text-slate-300" />
              {new Date(contribution.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {contribution.filePath && (
            <button 
              onClick={() => onDownload(contribution.filePath!, contribution.title)}
              className="flex items-center space-x-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-black hover:bg-emerald-100 hover:text-emerald-700 transition-all active:scale-95 group/dl border border-emerald-200/50 shadow-sm shadow-emerald-100/50"
            >
              <span>Download</span>
              <Download className="w-3.5 h-3.5 group-hover/dl:translate-y-0.5 transition-transform" />
            </button>
          )}

          {contribution.url && (
            <a 
              href={contribution.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center space-x-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold shadow-lg shadow-slate-900/10 hover:bg-brand transition-all active:scale-95 group/btn"
            >
              <span>Open Tool</span>
              <ExternalLink className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
