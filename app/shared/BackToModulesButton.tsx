import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface BackToModulesButtonProps {
  onClick: () => void;
  className?: string;
  disabled?: boolean;
}

export const BACK_TO_MODULES_LABEL = 'Back to Modules';

export const BackToModulesButton: React.FC<BackToModulesButtonProps> = ({
  onClick,
  className = '',
  disabled = false
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`btn-secondary h-10 min-w-[154px] whitespace-nowrap px-4 text-[10px] uppercase tracking-widest ${className}`.trim()}
  >
    <ArrowLeft className="h-4 w-4" />
    <span>{BACK_TO_MODULES_LABEL}</span>
  </button>
);
