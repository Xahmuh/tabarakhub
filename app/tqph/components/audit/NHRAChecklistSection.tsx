import React, { useState } from 'react';
import { Attachment, NHRAChecklistItem, NHRASection } from '../../types';
import { NHRAItemToggle } from './NHRAItemToggle';
import { ChevronDown, ChevronUp, CheckCheck, ShieldCheck } from 'lucide-react';
import { StatusBadge } from '../ui/StatusBadge';

interface NHRAChecklistSectionProps {
  section: NHRASection;
  attachments: Attachment[];
  onSectionChange: (updatedSection: NHRASection) => void;
  onAddAttachment: (att: Attachment) => void;
  onRemoveAttachment: (attId: string) => void;
  disabled?: boolean;
  defaultExpanded?: boolean;
}

export const NHRAChecklistSection: React.FC<NHRAChecklistSectionProps> = ({
  section,
  attachments,
  onSectionChange,
  onAddAttachment,
  onRemoveAttachment,
  disabled = false,
  defaultExpanded = true
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Compute section statistics
  const applicableItems = section.items.filter(it => it.status !== 'not_applicable');
  const fullyCompliantItems = section.items.filter(it => it.status === 'fully_compliant');
  const nonCompliantItems = section.items.filter(it => it.status === 'non_compliant');
  const partiallyCompliantItems = section.items.filter(it => it.status === 'partially_compliant');

  const sectionScore = applicableItems.length > 0
    ? ((fullyCompliantItems.length * 1.0 + partiallyCompliantItems.length * 0.5) / applicableItems.length) * 100
    : 100;

  const handleItemChange = (index: number, updatedItem: NHRAChecklistItem) => {
    const nextItems = [...section.items];
    nextItems[index] = updatedItem;
    onSectionChange({
      ...section,
      items: nextItems
    });
  };

  const handleMarkAllCompliant = (e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedItems = section.items.map(it => ({
      ...it,
      status: 'fully_compliant' as const,
      requires_corrective_action: false
    }));
    onSectionChange({
      ...section,
      items: updatedItems
    });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden transition-all shadow-sm">
      {/* Section Header */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="
          flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5 cursor-pointer select-none
          hover:bg-slate-50 transition-colors border-b border-transparent
        "
        style={{ borderBottomColor: isExpanded ? '#f1f5f9' : 'transparent' }}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="flex items-center justify-center px-2.5 py-1 rounded-lg bg-red-50 text-red-700 border border-red-200 font-mono text-xs font-black flex-shrink-0">
            {section.section_code}
          </span>
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-black text-slate-900 truncate">
              {section.title}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 font-medium">
              {fullyCompliantItems.length} compliant · {partiallyCompliantItems.length} partial · {nonCompliantItems.length} non-compliant
            </p>
          </div>
        </div>

        {/* Section Indicators & Actions */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <StatusBadge variant={{ type: 'compliance', score: sectionScore }} size="sm" />

          {!disabled && (
            <button
              type="button"
              onClick={handleMarkAllCompliant}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-950 border border-slate-200 text-xs font-bold transition-all"
              title="Set all items in this section to Fully Compliant"
            >
              <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>All Full</span>
            </button>
          )}

          <div className="p-1.5 text-slate-400">
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </div>
        </div>
      </div>

      {/* Section Items List */}
      {isExpanded && (
        <div className="p-4 sm:p-5 space-y-3.5 bg-slate-50/40 border-t border-slate-100">
          {section.items.map((item, idx) => (
            <NHRAItemToggle
              key={item.code}
              item={item}
              sectionCode={section.section_code}
              attachments={attachments}
              onChange={updatedItem => handleItemChange(idx, updatedItem)}
              onAddAttachment={onAddAttachment}
              onRemoveAttachment={onRemoveAttachment}
              disabled={disabled}
            />
          ))}
        </div>
      )}
    </div>
  );
};
