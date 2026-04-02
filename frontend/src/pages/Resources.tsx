import React, { useEffect, useState } from 'react';
import Header from '../components/Header';
import { useAuth } from '../context/AuthContext';
import { Resource } from '../types';
import { getResources, createResource, updateResource, deleteResource } from '../api/client';

const emptyForm = { name: '', email: '', role: '', skills: '' };

export default function Resources() {
  const { canEdit } = useAuth();
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  useEffect(() => {
    loadResources();
  }, []);

  async function loadResources() {
    try {
      setLoading(true);
      setError('');
      const data = await getResources();
      setResources(data);
    } catch (err: any) {
      setError('Failed to load resources. Is the backend running?');
    } finally {
      setLoading(false);
    }
  }

  function openAdd() {
    setEditingResource(null);
    setForm(emptyForm);
    setFormError('');
    setShowModal(true);
  }

  function openEdit(resource: Resource) {
    setEditingResource(resource);
    setForm({
      name: resource.name,
      email: resource.email,
      role: resource.role,
      skills: resource.skills.join(', '),
    });
    setFormError('');
    setShowModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    if (!form.name.trim() || !form.email.trim() || !form.role.trim()) {
      setFormError('Name, email, and role are required.');
      return;
    }
    const skillsArray = form.skills
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    try {
      setSaving(true);
      if (editingResource) {
        const updated = await updateResource(editingResource.id, {
          name: form.name.trim(),
          email: form.email.trim(),
          role: form.role.trim(),
          skills: skillsArray,
        });
        setResources(prev => prev.map(r => (r.id === updated.id ? updated : r)));
      } else {
        const created = await createResource({
          name: form.name.trim(),
          email: form.email.trim(),
          role: form.role.trim(),
          skills: skillsArray,
        });
        setResources(prev => [...prev, created]);
      }
      setShowModal(false);
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Failed to save resource');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteResource(id);
      setResources(prev => prev.filter(r => r.id !== id));
      setDeleteConfirm(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete resource');
    }
  }

  const skillColors = [
    'bg-blue-100 text-blue-700',
    'bg-purple-100 text-purple-700',
    'bg-green-100 text-green-700',
    'bg-orange-100 text-orange-700',
    'bg-pink-100 text-pink-700',
    'bg-teal-100 text-teal-700',
  ];

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Resources"
        subtitle={`${resources.length} developer${resources.length !== 1 ? 's' : ''}`}
        actions={
          canEdit ? (
            <button onClick={openAdd} className="btn-primary">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Resource
            </button>
          ) : null
        }
      />

      <div className="flex-1 p-6">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        ) : resources.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-lg font-medium text-gray-500">No resources yet</p>
            {canEdit && <p className="text-sm mt-1">Click "Add Resource" to get started</p>}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {resources.map(resource => (
              <div key={resource.id} className="card hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold text-sm flex-shrink-0">
                      {resource.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-sm">{resource.name}</h3>
                      <p className="text-xs text-gray-500">{resource.role}</p>
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => openEdit(resource)}
                        className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(resource.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 mb-3 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  {resource.email}
                </p>
                {resource.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {resource.skills.map((skill, i) => (
                      <span
                        key={skill}
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${skillColors[i % skillColors.length]}`}
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingResource ? 'Edit Resource' : 'Add Resource'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
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
                <label className="form-label">Full Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Alice Chen"
                />
              </div>
              <div>
                <label className="form-label">Email *</label>
                <input
                  type="email"
                  className="form-input"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="alice@company.com"
                />
              </div>
              <div>
                <label className="form-label">Role / Job Title *</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  placeholder="Senior Frontend Developer"
                />
              </div>
              <div>
                <label className="form-label">Skills (comma-separated)</label>
                <input
                  type="text"
                  className="form-input"
                  value={form.skills}
                  onChange={e => setForm(f => ({ ...f, skills: e.target.value }))}
                  placeholder="React, TypeScript, CSS"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1" disabled={saving}>
                  {saving ? 'Saving...' : editingResource ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Delete Resource</h2>
            <p className="text-gray-600 text-sm mb-5">
              Are you sure you want to delete{' '}
              <strong>{resources.find(r => r.id === deleteConfirm)?.name}</strong>?
              This will also remove all their allocations.
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
