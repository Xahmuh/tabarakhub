import React from 'react';
import { ShieldAlert } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  roles: string[];
  userRole?: string;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, roles, userRole }) => {
  const hasAccess = userRole && roles.some(role => role.toLowerCase() === userRole.toLowerCase());

  if (!hasAccess) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center p-8 text-center space-y-6 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-black text-slate-900 tracking-tight">Access Restricted</h3>
          <p className="text-slate-500 font-medium max-w-xs mx-auto">
            You do not have the required permissions to view this dashboard. Please contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
