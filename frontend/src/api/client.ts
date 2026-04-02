import axios from 'axios';
import { Resource, Project, Allocation, UtilizationSummary, AISuggestion, AuditLog, UserRecord } from '../types';

const api = axios.create({
  baseURL: 'http://localhost:3001/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Resources
export async function getResources(): Promise<Resource[]> {
  const { data } = await api.get('/resources');
  return data;
}

export async function createResource(resource: Omit<Resource, 'id' | 'created_at'>): Promise<Resource> {
  const { data } = await api.post('/resources', resource);
  return data;
}

export async function updateResource(id: number, resource: Omit<Resource, 'id' | 'created_at'>): Promise<Resource> {
  const { data } = await api.put(`/resources/${id}`, resource);
  return data;
}

export async function deleteResource(id: number): Promise<void> {
  await api.delete(`/resources/${id}`);
}

// Projects
export async function getProjects(): Promise<Project[]> {
  const { data } = await api.get('/projects');
  return data;
}

export async function createProject(project: Omit<Project, 'id' | 'created_at'>): Promise<Project> {
  const { data } = await api.post('/projects', project);
  return data;
}

export async function updateProject(id: number, project: Omit<Project, 'id' | 'created_at'>): Promise<Project> {
  const { data } = await api.put(`/projects/${id}`, project);
  return data;
}

export async function deleteProject(id: number): Promise<void> {
  await api.delete(`/projects/${id}`);
}

// Allocations
export interface AllocationFilters {
  resource_id?: number;
  project_id?: number;
  week_start_from?: string;
  week_start_to?: string;
}

export async function getAllocations(filters?: AllocationFilters): Promise<Allocation[]> {
  const { data } = await api.get('/allocations', { params: filters });
  return data;
}

export async function getUtilizationSummary(filters?: { week_start_from?: string; week_start_to?: string }): Promise<UtilizationSummary[]> {
  const { data } = await api.get('/allocations/summary/utilization', { params: filters });
  return data;
}

export async function createAllocation(allocation: {
  resource_id: number;
  project_id: number;
  week_start: string;
  percentage: number;
  notes?: string;
}): Promise<Allocation> {
  const { data } = await api.post('/allocations', allocation);
  return data;
}

export async function updateAllocation(id: number, allocation: Partial<{
  resource_id: number;
  project_id: number;
  week_start: string;
  percentage: number;
  notes: string;
}>): Promise<Allocation> {
  const { data } = await api.put(`/allocations/${id}`, allocation);
  return data;
}

export async function deleteAllocation(id: number): Promise<void> {
  await api.delete(`/allocations/${id}`);
}

// AI Planning
export interface AIPlanResponse {
  response: string;
  suggestions: AISuggestion[];
}

export async function planWithAI(params: {
  message: string;
  conversationHistory: Array<{ role: string; content: string }>;
  apiKey?: string;
}): Promise<AIPlanResponse> {
  const { data } = await api.post('/ai/plan', params);
  return data;
}

// Users
export async function getUsers(): Promise<UserRecord[]> {
  const { data } = await api.get('/users');
  return data;
}

export async function createUser(user: { username: string; password: string; full_name: string; email?: string; role: string }): Promise<UserRecord> {
  const { data } = await api.post('/users', user);
  return data;
}

export async function updateUser(id: number, updates: { full_name?: string; email?: string; role?: string }): Promise<UserRecord> {
  const { data } = await api.put(`/users/${id}`, updates);
  return data;
}

export async function resetUserPassword(id: number, temp_password: string): Promise<{ message: string }> {
  const { data } = await api.put(`/users/${id}/reset-password`, { temp_password });
  return data;
}

export async function deleteUser(id: number): Promise<void> {
  await api.delete(`/users/${id}`);
}

export async function changeMyPassword(new_password: string): Promise<{ message: string }> {
  const { data } = await api.put('/auth/change-password', { new_password });
  return data;
}

// Audit Log
export async function getAuditLog(params?: {
  entity_type?: string;
  user_id?: number;
  limit?: number;
  offset?: number;
}): Promise<{ logs: AuditLog[]; total: number }> {
  const { data } = await api.get('/audit-log', { params });
  return data;
}

export default api;
