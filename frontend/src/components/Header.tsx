import React from 'react';
import { useAuth } from '../context/AuthContext';

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  team_lead: { label: 'Team Lead', color: 'bg-indigo-100 text-indigo-700' },
  manager:   { label: 'Manager',   color: 'bg-purple-100 text-purple-700' },
  viewer:    { label: 'Viewer',    color: 'bg-gray-100 text-gray-600' },
};

interface HeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export default function Header({ title, subtitle, actions }: HeaderProps) {
  const { user, logout } = useAuth();
  const roleInfo = user ? (ROLE_LABELS[user.role] || { label: user.role, color: 'bg-gray-100 text-gray-600' }) : null;

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
          {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-4">
          {actions && <div className="flex items-center gap-2">{actions}</div>}
          {user && roleInfo && (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900 leading-tight">{user.fullName}</p>
                <div className="flex items-center justify-end gap-1 mt-0.5">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${roleInfo.color}`}>
                    {roleInfo.label}
                  </span>
                </div>
              </div>
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                {user.fullName.charAt(0)}
              </div>
              <button
                onClick={logout}
                title="Sign out"
                className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
