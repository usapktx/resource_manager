import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Role } from '../types';

interface RoleContextType {
  role: Role;
  setRole: (role: Role) => void;
  isTeamLead: boolean;
  isManager: boolean;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>(() => {
    const saved = localStorage.getItem('rm_role');
    return (saved as Role) || 'team-lead';
  });

  const handleSetRole = (newRole: Role) => {
    localStorage.setItem('rm_role', newRole);
    setRole(newRole);
  };

  return (
    <RoleContext.Provider
      value={{
        role,
        setRole: handleSetRole,
        isTeamLead: role === 'team-lead',
        isManager: role === 'manager',
      }}
    >
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
}
