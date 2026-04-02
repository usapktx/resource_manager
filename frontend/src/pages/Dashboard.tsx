import React, { useEffect, useState, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import Header from '../components/Header';
import { Resource, Project, Allocation, UtilizationSummary } from '../types';
import { getResources, getProjects, getAllocations, getUtilizationSummary } from '../api/client';

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

function formatWeekShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getHeatmapColor(pct: number): string {
  if (pct === 0) return 'bg-gray-50 text-gray-300';
  if (pct < 80) return 'bg-green-100 text-green-700 font-medium';
  if (pct < 100) return 'bg-yellow-100 text-yellow-700 font-medium';
  return 'bg-red-100 text-red-700 font-bold';
}

// Chart colors for projects
const CHART_COLORS = [
  '#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#14b8a6', '#f97316', '#84cc16',
];

export default function Dashboard() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [utilization, setUtilization] = useState<UtilizationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [weekOffset, setWeekOffset] = useState(-2);

  const currentMonday = getMonday(new Date());
  const weeks = Array.from({ length: 9 }, (_, i) => addWeeks(currentMonday, weekOffset + i));

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const fromWeek = weeks[0];
      const toWeek = weeks[weeks.length - 1];

      const [res, proj, allocs, util] = await Promise.all([
        getResources(),
        getProjects(),
        getAllocations({ week_start_from: fromWeek, week_start_to: toWeek }),
        getUtilizationSummary({ week_start_from: fromWeek, week_start_to: toWeek }),
      ]);

      setResources(res);
      setProjects(proj);
      setAllocations(allocs);
      setUtilization(util);
    } catch {
      setError('Failed to load dashboard data. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }, [weekOffset]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Build heatmap: resourceId -> weekStart -> totalPct
  const heatmap: Record<number, Record<string, number>> = {};
  resources.forEach(r => {
    heatmap[r.id] = {};
    weeks.forEach(w => { heatmap[r.id][w] = 0; });
  });
  utilization.forEach(u => {
    if (heatmap[u.resource_id]) {
      heatmap[u.resource_id][u.week_start] = u.total_percentage;
    }
  });

  // Build stacked bar chart data: per resource, per week, broken down by project
  const projectColorMap: Record<number, string> = {};
  projects.forEach((p, i) => {
    projectColorMap[p.id] = CHART_COLORS[i % CHART_COLORS.length];
  });

  // Chart data: array of { resourceName, [projectName]: pct, ... } per week
  // We'll do: for each resource, build a series of weekly bars stacked by project
  // Group by resource
  const resourceChartData: Array<{
    resource: Resource;
    data: Array<Record<string, number | string>>;
  }> = resources.map(resource => {
    const data = weeks.map(week => {
      const weekAllocs = allocations.filter(
        a => a.resource_id === resource.id && a.week_start === week
      );
      const entry: Record<string, number | string> = { week: formatWeekShort(week) };
      weekAllocs.forEach(a => {
        const projName = a.project_name || `Project ${a.project_id}`;
        entry[projName] = (entry[projName] as number || 0) + a.percentage;
      });
      return entry;
    });
    return { resource, data };
  });

  // Project breakdown: for each project, list allocated resources and their avg %
  const projectBreakdown = projects.map(project => {
    const projAllocs = allocations.filter(a => a.project_id === project.id);
    const resourceMap: Record<number, { name: string; total: number; weeks: number }> = {};
    projAllocs.forEach(a => {
      if (!resourceMap[a.resource_id]) {
        resourceMap[a.resource_id] = {
          name: a.resource_name || 'Unknown',
          total: 0,
          weeks: 0,
        };
      }
      resourceMap[a.resource_id].total += a.percentage;
      resourceMap[a.resource_id].weeks += 1;
    });
    return {
      project,
      resources: Object.values(resourceMap).map(r => ({
        name: r.name,
        avgPct: Math.round(r.total / r.weeks),
        weeks: r.weeks,
      })),
    };
  }).filter(pb => pb.resources.length > 0);

  // All project names in allocations (for chart legend)
  const allProjectNames = [...new Set(allocations.map(a => a.project_name || ''))].filter(Boolean);

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Manager Dashboard"
        subtitle="Resource utilization overview"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <button onClick={() => setWeekOffset(w => w - 4)} className="btn-secondary px-2 py-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button onClick={() => setWeekOffset(-2)} className="btn-secondary px-3 py-1.5 text-xs">
                Today
              </button>
              <button onClick={() => setWeekOffset(w => w + 4)} className="btn-secondary px-2 py-1.5">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <button onClick={loadData} className="btn-secondary px-3 py-1.5" title="Refresh">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
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
          <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="card text-center">
                <p className="text-3xl font-bold text-indigo-600">{resources.length}</p>
                <p className="text-sm text-gray-500 mt-1">Developers</p>
              </div>
              <div className="card text-center">
                <p className="text-3xl font-bold text-green-600">
                  {projects.filter(p => p.status === 'active').length}
                </p>
                <p className="text-sm text-gray-500 mt-1">Active Projects</p>
              </div>
              <div className="card text-center">
                <p className="text-3xl font-bold text-blue-600">{allocations.length}</p>
                <p className="text-sm text-gray-500 mt-1">Allocations (visible)</p>
              </div>
              <div className="card text-center">
                <p className="text-3xl font-bold text-red-500">
                  {utilization.filter(u => u.total_percentage >= 100).length}
                </p>
                <p className="text-sm text-gray-500 mt-1">Overallocated Weeks</p>
              </div>
            </div>

            {/* Utilization Heatmap */}
            <div className="card p-0 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">Resource Utilization Heatmap</h2>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-green-100 border border-green-200" />
                    &lt;80%
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-yellow-100 border border-yellow-200" />
                    80-99%
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded bg-red-100 border border-red-200" />
                    ≥100%
                  </span>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 min-w-[180px]">
                        Resource
                      </th>
                      {weeks.map(w => (
                        <th key={w} className="px-2 py-3 text-xs font-semibold text-gray-600 min-w-[80px] text-center">
                          {formatWeekShort(w)}
                        </th>
                      ))}
                      <th className="px-4 py-3 text-xs font-semibold text-gray-600 text-right">Avg</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resources.map(resource => {
                      const weekValues = weeks.map(w => heatmap[resource.id]?.[w] || 0);
                      const avg = Math.round(weekValues.reduce((a, b) => a + b, 0) / weekValues.length);
                      return (
                        <tr key={resource.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                          <td className="px-4 py-3">
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
                            const pct = heatmap[resource.id]?.[week] || 0;
                            return (
                              <td key={week} className="px-1 py-2 text-center">
                                <span className={`inline-block w-14 py-1 rounded text-xs ${getHeatmapColor(pct)}`}>
                                  {pct > 0 ? `${pct}%` : '—'}
                                </span>
                              </td>
                            );
                          })}
                          <td className="px-4 py-3 text-right">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs ${getHeatmapColor(avg)}`}>
                              {avg > 0 ? `${avg}%` : '—'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Resource Timeline Chart */}
            {allocations.length > 0 && (
              <div className="card">
                <h2 className="font-semibold text-gray-900 mb-4">Resource Timeline (Stacked by Project)</h2>
                <div className="space-y-6">
                  {resourceChartData
                    .filter(rc => rc.data.some(d => Object.keys(d).length > 1))
                    .map(rc => {
                      const projectsInChart = [
                        ...new Set(
                          rc.data.flatMap(d => Object.keys(d).filter(k => k !== 'week'))
                        ),
                      ];
                      if (projectsInChart.length === 0) return null;
                      return (
                        <div key={rc.resource.id}>
                          <p className="text-sm font-medium text-gray-700 mb-2">
                            {rc.resource.name}
                            <span className="text-gray-400 font-normal ml-2 text-xs">{rc.resource.role}</span>
                          </p>
                          <ResponsiveContainer width="100%" height={120}>
                            <BarChart
                              data={rc.data}
                              margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                              <XAxis
                                dataKey="week"
                                tick={{ fontSize: 10, fill: '#9ca3af' }}
                                axisLine={false}
                                tickLine={false}
                              />
                              <YAxis
                                domain={[0, 120]}
                                tick={{ fontSize: 10, fill: '#9ca3af' }}
                                axisLine={false}
                                tickLine={false}
                              />
                              <Tooltip
                                contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }}
                                formatter={(value: number, name: string) => [`${value}%`, name]}
                              />
                              {projectsInChart.map((projName, idx) => (
                                <Bar
                                  key={projName}
                                  dataKey={projName}
                                  stackId="a"
                                  fill={CHART_COLORS[idx % CHART_COLORS.length]}
                                  radius={idx === projectsInChart.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                                />
                              ))}
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Project Breakdown */}
            {projectBreakdown.length > 0 && (
              <div className="card">
                <h2 className="font-semibold text-gray-900 mb-4">Project Breakdown</h2>
                <div className="space-y-4">
                  {projectBreakdown.map(({ project, resources: projResources }) => (
                    <div key={project.id} className="border border-gray-100 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <h3 className="font-medium text-gray-900">{project.name}</h3>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            project.status === 'active'
                              ? 'bg-green-100 text-green-700'
                              : project.status === 'on-hold'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {project.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                        {projResources.map(r => (
                          <div key={r.name} className="bg-gray-50 rounded-lg p-2.5">
                            <p className="text-xs font-medium text-gray-900">{r.name}</p>
                            <p className="text-lg font-bold text-indigo-600">{r.avgPct}%</p>
                            <p className="text-xs text-gray-400">avg over {r.weeks} week{r.weeks !== 1 ? 's' : ''}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {allocations.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <p className="text-lg font-medium text-gray-500">No allocations in this date range</p>
                <p className="text-sm mt-1">Try navigating to a different week range</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
