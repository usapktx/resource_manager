export interface Resource {
  id: number;
  name: string;
  email: string;
  role: string;
  skills: string[];
  created_at?: string;
}

export interface Project {
  id: number;
  name: string;
  description: string;
  start_date: string;
  end_date: string;
  status: 'active' | 'completed' | 'on-hold';
  created_at?: string;
}

export interface Allocation {
  id: number;
  resource_id: number;
  project_id: number;
  week_start: string;
  percentage: number;
  notes: string;
  resource_name?: string;
  resource_role?: string;
  project_name?: string;
  project_status?: string;
  created_by_name?: string;
  updated_by_name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface UtilizationSummary {
  resource_id: number;
  resource_name: string;
  resource_role: string;
  week_start: string;
  total_percentage: number;
}

export type UserRole = 'team_lead' | 'manager' | 'viewer';

export interface AuthUser {
  id: number;
  username: string;
  fullName: string;
  email: string;
  role: UserRole;
}

export interface UserRecord {
  id: number;
  username: string;
  full_name: string;
  email: string;
  role: UserRole;
  force_password_reset: number;
  created_at: string;
}

export interface AuditLog {
  id: number;
  user_id: number;
  user_name: string;
  user_role: UserRole;
  action: 'created' | 'updated' | 'deleted';
  entity_type: 'allocation' | 'resource' | 'project';
  entity_id: number;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestions?: AISuggestion[];
}

export interface AISuggestion {
  resource_id: number | null;
  resource_name: string;
  project_id: number | null;
  project_name: string;
  week_start: string;
  percentage: number;
  notes: string;
}
