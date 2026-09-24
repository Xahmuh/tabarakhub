import React from 'react';
import { AppraisalCriterion, AppraisalSection, LetterGrade } from '../../types';
import { RatingCard } from '../ui/RatingCard';
import { getGradePoints } from '../../services/scoringService';

interface AppraisalSectionCardProps {
  section: AppraisalSection;
  onSectionChange: (updatedSection: AppraisalSection) => void;
  disabled?: boolean;
}

export const AppraisalSectionCard: React.FC<AppraisalSectionCardProps> = ({
  section,
  onSectionChange,
  disabled = false
}) => {
  const sectionPoints = section.criteria.reduce(
    (sum, c) => sum + getGradePoints(c.grade),
    0
  );
  const maxSectionPoints = section.criteria.length * 5;

  const handleCriterionGradeChange = (index: number, newGrade: LetterGrade) => {
    const updatedCriteria = [...section.criteria];
    updatedCriteria[index] = {
      ...updatedCriteria[index],
      grade: newGrade,
      points: getGradePoints(newGrade)
    };

    onSectionChange({
      ...section,
      criteria: updatedCriteria
    });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-sm">
      {/* Pillar Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-red-50 text-red-700 border border-red-200 font-mono text-xs font-black">
            {section.section_id}
          </span>
          <div>
            <h3 className="text-sm sm:text-base font-black text-slate-900">
              {section.title}
            </h3>
            <p className="text-xs text-slate-400 font-medium">
              {section.criteria.length} evaluation criteria
            </p>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 px-3 py-1 rounded-lg text-right">
          <span className="text-[10px] text-slate-400 block font-black uppercase tracking-wider font-mono">Pillar Score</span>
          <span className="text-xs font-black font-mono text-slate-900">
            {sectionPoints} / {maxSectionPoints} pts
          </span>
        </div>
      </div>

      {/* Criteria List */}
      <div className="space-y-3">
        {section.criteria.map((criterion, idx) => (
          <div
            key={criterion.code}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50/60 border border-slate-200/70 hover:bg-white hover:border-slate-300 transition-all"
          >
            <div className="flex items-start gap-2.5 min-w-0 flex-1">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 flex-shrink-0 mt-0.5">
                {criterion.code}
              </span>
              <span className="text-xs sm:text-sm font-bold text-slate-800 leading-snug">
                {criterion.label}
              </span>
            </div>

            <div className="flex-shrink-0 self-end sm:self-center">
              <RatingCard
                variant="grade"
                value={criterion.grade}
                onChange={newGrade => handleCriterionGradeChange(idx, newGrade)}
                disabled={disabled}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
