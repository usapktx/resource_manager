import React, { useEffect, useState, useCallback } from 'react';
import Header from '../components/Header';
import { useAuth } from '../context/AuthContext';
import { Allocation, Resource, Project } from '../types';
import {
  getAllocations,
  getResources,
  getProjects,
  createAllocation,
  updateAllocation,
  deleteAllocation,
} from '../api/client';

function getMonday(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

function addWeeks(dateStr: string, weeks: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().split('T')[0];
}

function formatWeek(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getUtilizationColor(pct: number): string {
  if (pct === 0) return 'bg-gray-50 text-gray-400';
  if (pct < 80) return 'bg-green-100 text-green-800';
  if (pct <= 100) return 'bg-yellow-100 text-yellow-800';
  return 'bg-red-100 text-red-800';
}

interface CellAllocation {
  projectName: string;
  percentage: number;
  allocationId: number;
  projectId: number;
  resourceId: number;
}

interface CellPopup {
  resourceId: number;
  weekStart: string;
  allocations: CellAllocation[];
  top: number;
  left: number;
}

export default function Allocations() {
  const { canEdit } = useAuth();
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [weekOffset, setWeekOffset] = useState(0);

  const [showModal, setShowModal] = useState(false);
  const [editingAllocation, setEditingAllocation] = useState<Allocation | null>(null);
  const [form, setForm] = useState({
    resource_id: '',
    project_id: '',
    week_start: '',
    percentage: '',
    notes: '',
  });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [cellPopup, setCellPopup] = useState<CellPopup | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const currentMonday = getMonday(new Date());
  const weeks = Array.from({ length: 8 }, (_, i) => addWeeks(currentMonday, weekOffset + i));

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const fromWeek = weeks[0];
      const toWeek = weeks[weeks.length - 1];
      const [allocs, res, proj] = await Promise.all([
        getAllocations({ week_start_from: addWeeks(fromWeek, -1), week_start_to: addWeeks(toWeek, 1) }),
        getResources(),
        getProjects(),
      ]);
      setAllocations(allocs);
      setResources(res);
      setProjects(proj);
    } catch {
      setError('Failed to load data. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }, [weekOffset]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Build grid data: resourceId -> weekStart -> { total, allocations[] }
  const gridData: Record<number, Record<string, { total: number; allocations: CellAllocation[] }>> = {};
  resources.forEach(r => {
    gridData[r.id] = {};
    weeks.forEach(w => {
      gridData[r.id][w] = { total: 0, allocations: [] };
    });
  });

  allocations.forEach(a => {
    if (gridData[a.resource_id] && gridData[a.resource_id][a.week_start]) {
      gridData[a.resource_id][a.week_start].total += a.percentage;
      gridData[a.resource_id][a.week_start].allocations.push({
        projectName: a.project_name || 'Unknown',
        percentage: a.percentage,
        allocationId: a.id,
        projectId: a.project_id,
        resourceId: a.resource_id,
      });
    }
  });

  function openAdd(prefillResourceId?: number, prefillWeek?: string) {
    setEditingAllocation(null);
    setForm({
      resource_id: prefillResourceId?.toString() || '',
      project_id: '',
      week_start: prefillWeek || weeks[0],
      percentage: '50',
      notes: '',
    });
    setFormError('');
    setShowModal(true);
    setCellPopup(null);
  }

  function openEdit(allocation: Allocation) {
    setEditingAllocation(allocation);
    setForm({
      resource_id: allocation.resource_id.toString(),
      project_id: allocation.project_id.toString(),
      week_start: allocation.week_start,
      percentage: allocation.percentage.toString(),
      notes: allocation.notes || '',
    });
    setFormError('');
    setShowModal(true);
    setCellPopup(null);
  }

  function openEditById(allocationId: number) {
    const alloc = allocations.find(a => a.id === allocationId);
    if (alloc) openEdit(alloc);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    const pct = parseInt(form.percentage);
    if (!form.resource_id || !form.project_id || !form.week_start || isNaN(pct)) {
      setFormError('All fields except notes are required.');
      return;
    }
    if (pct < 0 || pct > 200) {
      setFormError('Percentage must be between 0 and 200.');
      return;
    }
    try {
      setSaving(true);
      const payload = {
        resource_id: parseInt(form.resource_id),
        project_id: parseInt(form.project_id),
        week_start: form.week_start,
        percentage: pct,
        notes: form.notes,
      };
      if (editingAllocation) {
        const updated = await updateAllocation(editingAllocation.id, payload);
        setAllocations(prev => prev.map(a => (a.id === updated.id ? updated : a)));
      } else {
        const created = await createAllocation(payload);
        setAllocations(prev => [...prev, created]);
      }
      setShowModal(false);
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Failed to save allocation');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteAllocation(id);
      setAllocations(prev => prev.filter(a => a.id !== id));
      setDeleteConfirm(null);
      setCellPopup(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete allocation');
    }
  }

  function handleCellClick(e: React.MouseEvent, resourceId: number, weekStart: string) {
    const cell = gridData[resourceId][weekStart];
    if (cell.allocations.length === 0) {
      if (canEdit) openAdd(resourceId, weekStart);
      return;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setCellPopup({
      resourceId,
      weekStart,
      allocations: cell.allocations,
      top: rect.bottom + window.scrollY + 4,
      left: rect.left + window.scrollX,
    });
  }

  // Project breakdown across visible weeks
  const projectBreakdown: Record<number, { project: Project; totalPct: number; resourceCount: number }> = {};
  projects.forEach(p => {
    const relevant = allocations.filter(a => a.project_id === p.id && weeks.includes(a.week_start));
    if (relevant.length > 0) {
      const uniqueResources = new Set(relevant.map(a => a.resource_id)).size;
      projectBreakdown[p.id] = {
        project: p,
        totalPct: relevant.reduce((sum, a) => sum + a.percentage, 0),
        resourceCount: uniqueResources,
      };
    }
  });

  return (
    <div className="flex flex-col h-full" onClick={() => setCellPopup(null)}>
      <Header
        title="Allocations"
        subtitle="Weekly resource allocation grid"
        actions={
          <>
            <div className="flex items-center gap-1">
              <button onClick={() => setWeekOffset(w => w - 4)} className="btn-secondary px-2 py-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button onClick={() => setWeekOffset(0)} className="btn-secondary px-3 py-1.5 text-xs">
                Today
              </button>
              <button onClick={() => setWeekOffset(w => w + 4)} className="btn-secondary px-2 py-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            {canEdit && (
              <button onClick={() => openAdd()} className="btn-primary">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Allocation
              </button>
            )}
          </>
        }
      />

      <div className="flex-1 p-6 overflow-auto">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Legend */}
            <div className="flex items-center gap-4 mb-4 text-xs">
              <span className="text-gray-500 font-medium">Utilization:</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-100 border border-green-200" /> &lt;80%</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-100 border border-yellow-200" /> 80-100%</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 border border-red-200" /> &gt;100%</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-50 border border-gray-200" /> 0%</span>
            </div>

            {/* Grid */}
            <div className="card p-0 overflow-x-auto mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 bg-gray-50 min-w-[160px] sticky left-0">
                      Resource
                    </th>
                    {weeks.map(w => (
                      <th key={w} className="px-3 py-3 text-xs font-semibold text-gray-600 bg-gray-50 min-w-[90px] text-center">
                        <div>{formatWeek(w)}</div>
                        <div className="text-gray-400 font-normal">
                          {new Date(w + 'T00:00:00').getFullYear()}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {resources.map(resource => (
                    <tr key={resource.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                      <td className="px-4 py-3 sticky left-0 bg-white">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-semibold flex-shrink-0">
                            {resource.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900 text-xs">{resource.name}</div>
                            <div className="text-gray-400 text-xs">{resource.role.split(' ').slice(0, 2).join(' ')}</div>
                          </div>
                        </div>
                      </td>
                      {weeks.map(week => {
                        const cell = gridData[resource.id]?.[week] || { total: 0, allocations: [] };
                        return (
                          <td key={week} className="px-1 py-1 text-center">
                            <div
                              onClick={e => { e.stopPropagation(); handleCellClick(e, resource.id, week); }}
                              className={`mx-auto w-16 h-10 rounded-lg flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity font-semibold text-xs ${getUtilizationColor(cell.total)}`}
                              title={`${resource.name} - week of ${week}: ${cell.total}% allocated`}
                            >
                              {cell.total > 0 ? `${cell.total}%` : '—'}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Project Breakdown */}
            {Object.keys(projectBreakdown).length > 0 && (
              <div className="card">
                <h3 className="font-semibold text-gray-900 mb-4">Project Breakdown (visible weeks)</h3>
                <div className="space-y-3">
                  {Object.values(projectBreakdown).map(({ project, totalPct, resourceCount }) => (
                    <div key={project.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                      <div>
                        <span className="font-medium text-sm text-gray-900">{project.name}</span>
                        <span className="ml-2 text-xs text-gray-500">{resourceCount} resource{resourceCount !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="text-sm text-gray-600">
                        {totalPct}% total allocation across visible weeks
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Cell Popup */}
      {cellPopup && (
        <div
          className="fixed z-40 bg-white rounded-xl shadow-xl border border-gray-200 w-72 p-4"
          style={{ top: cellPopup.top, left: Math.min(cellPopup.left, window.innerWidth - 300) }}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="font-semibold text-sm text-gray-900">
                {resources.find(r => r.id === cellPopup.resourceId)?.name}
              </p>
              <p className="text-xs text-gray-500">Week of {formatWeek(cellPopup.weekStart)}</p>
            </div>
            <button onClick={() => setCellPopup(null)} className="text-gray-400 hover:text-gray-600">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="space-y-2 mb-3">
            {cellPopup.allocations.map(a => (
              <div key={a.allocationId} className="flex items-center justify-between text-sm">
                <span className="text-gray-700 truncate flex-1">{a.projectName}</span>
                <div className="flex items-center gap-2 ml-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getUtilizationColor(a.percentage)}`}>
                    {a.percentage}%
                  </span>
                  {canEdit && (
                    <>
                      <button
                        onClick={() => openEditById(a.allocationId)}
                        className="text-gray-400 hover:text-indigo-600"
                        title="Edit"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => { setDeleteConfirm(a.allocationId); setCellPopup(null); }}
                        className="text-gray-400 hover:text-red-600"
                        title="Delete"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
          {canEdit && (
            <button
              onClick={() => openAdd(cellPopup.resourceId, cellPopup.weekStart)}
              className="w-full text-xs text-indigo-600 hover:text-indigo-700 font-medium py-1 border border-dashed border-indigo-300 rounded-lg hover:bg-indigo-50 transition-colors"
            >
              + Add another allocation
            </button>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingAllocation ? 'Edit Allocation' : 'Add Allocation'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                  {formError}
                </div>
              )}
              <div>
                <label className="form-label">Resource *</label>
                <select
                  className="form-input"
                  value={form.resource_id}
                  onChange={e => setForm(f => ({ ...f, resource_id: e.target.value }))}
                >
                  <option value="">Select a resource...</option>
                  {resources.map(r => (
                    <option key={r.id} value={r.id}>{r.name} — {r.role}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Project *</label>
                <select
                  className="form-input"
                  value={form.project_id}
                  onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}
                >
                  <option value="">Select a project...</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Week Starting (Monday) *</label>
                <select
                  className="form-input"
                  value={form.week_start}
                  onChange={e => setForm(f => ({ ...f, week_start: e.target.value }))}
                >
                  {Array.from({ length: 12 }, (_, i) => addWeeks(currentMonday, i - 2)).map(w => (
                    <option key={w} value={w}>
                      {new Date(w + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Allocation % (0-200) *</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={Math.min(parseInt(form.percentage) || 0, 100)}
                    onChange={e => setForm(f => ({ ...f, percentage: e.target.value }))}
                    className="flex-1 accent-indigo-600"
                  />
                  <input
                    type="number"
                    min="0"
                    max="200"
                    className="form-input w-20 text-center"
                    value={form.percentage}
                    onChange={e => setForm(f => ({ ...f, percentage: e.target.value }))}
                  />
                  <span className="text-sm text-gray-500">%</span>
                </div>
              </div>
              <div>
                <label className="form-label">Notes</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Optional notes..."
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1" disabled={saving}>
                  {saving ? 'Saving...' : editingAllocation ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Delete Allocation</h2>
            <p className="text-gray-600 text-sm mb-5">
              Are you sure you want to delete this allocation?
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary flex-1">
                Cancel
              </button>
              <button onClick={() => handleDelete(deleteConfirm)} className="btn-danger flex-1">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
