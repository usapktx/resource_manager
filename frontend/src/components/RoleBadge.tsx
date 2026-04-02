import React from 'react';
import { useRole } from '../context/RoleContext';
import { Role } from '../types';

export default function RoleBadge() {
  const { role, setRole } = useRole();

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-500">Role:</span>
      <div className="flex rounded-lg border border-gray-200 overflow-hidden bg-gray-100 p-0.5 gap-0.5">
        <button
          onClick={() => setRole('team-lead')}
          className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
            role === 'team-lead'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Team Lead
        </button>
        <button
          onClick={() => setRole('manager')}
          className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
            role === 'manager'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Manager
        </button>
      </div>
    </div>
  );
}
