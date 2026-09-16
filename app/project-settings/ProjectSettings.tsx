import React from 'react';
import { ControlCenter, ControlCenterProps } from './ControlCenter';
import { MaintenanceSettings, Role } from '../../types';

export interface ProjectSettingsProps {
  onBack: () => void;
  onSettingsChange?: (settings: MaintenanceSettings) => void;
  currentRole?: Role;
  mode?: 'combined' | 'system' | 'access';
  initialTab?: any;
}

/**
 * Backward compatibility wrapper delegating directly to the Unified ControlCenter.
 */
export const ProjectSettings: React.FC<ProjectSettingsProps> = props => {
  return <ControlCenter {...props} />;
};

export default ProjectSettings;
