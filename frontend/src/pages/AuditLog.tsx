import React, { useEffect, useState } from 'react';
import Header from '../components/Header';
import { getAuditLog } from '../api/client';
import { AuditLog } from '../types';

const ACTION_COLORS = {
  created: 'bg-green-100 text-green-700',
  updated: 'bg-blue-100 text-blue-700',
  deleted: 'bg-red-100 text-red-700',
};

const ENTITY_COLORS = {
  allocation: 'bg-indigo-100 text-indigo-700',
  resource: 'bg-amber-100 text-amber-700',
  project: 'bg-teal-100 text-teal-700',
};

const ROLE_LABELS: Record<string, string> = {
  team_lead: 'Team Lead',
  manager: 'Manager',
  viewer: 'Viewer',
};

function formatDetails(log: AuditLog): string {
  const d = log.details;
  if (!d) return '';
  if (log.entity_type === 'allocation') {
    if (log.action === 'created') {
      return `${d.resource_name} → ${d.project_name} | Week ${d.week_start} | ${d.percentage}%`;
    }
    if (log.action === 'updated') {
      return `${d.resource_name} → ${d.project_name} | Week ${d.week_start} | ${d.old_percentage}% → ${d.new_percentage}%`;
    }
    if (log.action === 'deleted') {
      return `${d.resource_name} → ${d.project_name} | Week ${d.week_start} | ${d.percentage}%`;
    }
  }
  if (log.entity_type === 'resource') {
    if (log.action === 'created') return `${d.name} (${d.role})`;
    if (log.action === 'updated') return `${(d.previous as Record<string, unknown>)?.name} → ${d.name}`;
    if (log.action === 'deleted') return `${d.name}`;
  }
  if (log.entity_type === 'project') {
    if (log.action === 'created') return `${d.name}`;
    if (log.action === 'updated') return `${(d.previous as Record<string, unknown>)?.name} → ${d.name}`;
    if (log.action === 'deleted') return `${d.name}`;
  }
  return JSON.stringify(d);
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterEntity, setFilterEntity] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const result = await getAuditLog({
        entity_type: filterEntity || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setLogs(result.logs);
      setTotal(result.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, [filterEntity, page]);

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Audit Log"
        subtitle={`${total} total change${total !== 1 ? 's' : ''} tracked`}
        actions={
          <select
            value={filterEntity}
            onChange={e => { setFilterEntity(e.target.value); setPage(0); }}
            className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All types</option>
            <option value="allocation">Allocations</option>
            <option value="resource">Resources</option>
            <option value="project">Projects</option>
          </select>
        }
      />

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            No audit log entries yet.
          </div>
        ) : (
          <>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Time</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">User</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatTime(log.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{log.user_name}</div>
                        <div className="text-xs text-gray-400">{ROLE_LABELS[log.user_role] || log.user_role}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-600'}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${ENTITY_COLORS[log.entity_type] || 'bg-gray-100 text-gray-600'}`}>
                          {log.entity_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{formatDetails(log)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {total > PAGE_SIZE && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-gray-500">
                  Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => p - 1)}
                    disabled={page === 0}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={(page + 1) * PAGE_SIZE >= total}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
