import React, { useEffect, useState } from 'react';
import Header from '../components/Header';
import { useAuth } from '../context/AuthContext';
import { getUsers, createUser, updateUser, resetUserPassword, deleteUser } from '../api/client';
import { UserRecord, UserRole } from '../types';

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  team_lead: { label: 'Team Lead', color: 'bg-indigo-100 text-indigo-700' },
  manager:   { label: 'Manager',   color: 'bg-purple-100 text-purple-700' },
  viewer:    { label: 'Viewer',    color: 'bg-gray-100 text-gray-600' },
};

type ModalMode = 'add' | 'edit' | 'reset' | null;

export default function Users() {
  const { canEdit, user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Add/Edit form
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formFullName, setFormFullName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('viewer');

  // Reset password form
  const [tempPassword, setTempPassword] = useState('');
  const [showTempPw, setShowTempPw] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      setUsers(await getUsers());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const openAdd = () => {
    setFormUsername(''); setFormPassword(''); setFormFullName('');
    setFormEmail(''); setFormRole('viewer');
    setError(''); setModalMode('add');
  };

  const openEdit = (u: UserRecord) => {
    setSelectedUser(u);
    setFormFullName(u.full_name); setFormEmail(u.email || '');
    setFormRole(u.role); setError(''); setModalMode('edit');
  };

  const openReset = (u: UserRecord) => {
    setSelectedUser(u); setTempPassword(''); setShowTempPw(false);
    setError(''); setModalMode('reset');
  };

  const closeModal = () => { setModalMode(null); setSelectedUser(null); setError(''); };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    try {
      await createUser({ username: formUsername, password: formPassword, full_name: formFullName, email: formEmail, role: formRole });
      setSuccess(`User "${formFullName}" created successfully`);
      closeModal(); fetchUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to create user');
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (!selectedUser) return;
    try {
      await updateUser(selectedUser.id, { full_name: formFullName, email: formEmail, role: formRole });
      setSuccess('User updated successfully');
      closeModal(); fetchUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to update user');
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (!selectedUser) return;
    try {
      const result = await resetUserPassword(selectedUser.id, tempPassword);
      setSuccess(result.message);
      closeModal(); fetchUsers();
      setTimeout(() => setSuccess(''), 5000);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to reset password');
    }
  };

  const handleDelete = async (u: UserRecord) => {
    if (!confirm(`Delete user "${u.full_name}"? This cannot be undone.`)) return;
    try {
      await deleteUser(u.id);
      setSuccess(`User "${u.full_name}" deleted`);
      fetchUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: unknown) {
      setSuccess('');
      alert((err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to delete user');
    }
  };

  return (
    <div className="flex flex-col h-full">
      <Header
        title="User Management"
        subtitle="Manage team members and access roles"
        actions={canEdit && (
          <button onClick={openAdd} className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add User
          </button>
        )}
      />

      <div className="flex-1 overflow-auto p-6">
        {success && (
          <div className="mb-4 flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {success}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full" />
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Username</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  {canEdit && <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map(u => {
                  const roleInfo = ROLE_LABELS[u.role] || { label: u.role, color: 'bg-gray-100 text-gray-600' };
                  const isMe = u.id === currentUser?.id;
                  return (
                    <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-semibold flex-shrink-0">
                            {u.full_name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{u.full_name}</p>
                            {isMe && <p className="text-xs text-indigo-500">You</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs">{u.username}</td>
                      <td className="px-4 py-3 text-gray-600">{u.email || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${roleInfo.color}`}>
                          {roleInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {u.force_password_reset === 1 ? (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Password reset pending
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Active
                          </span>
                        )}
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button onClick={() => openEdit(u)} className="text-xs text-gray-600 hover:text-indigo-600 border border-gray-200 hover:border-indigo-300 px-2.5 py-1 rounded-lg transition-colors">
                              Edit
                            </button>
                            <button onClick={() => openReset(u)} className="text-xs text-gray-600 hover:text-amber-600 border border-gray-200 hover:border-amber-300 px-2.5 py-1 rounded-lg transition-colors">
                              Reset Password
                            </button>
                            {!isMe && (
                              <button onClick={() => handleDelete(u)} className="text-xs text-gray-600 hover:text-red-600 border border-gray-200 hover:border-red-300 px-2.5 py-1 rounded-lg transition-colors">
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add User Modal */}
      {modalMode === 'add' && (
        <Modal title="Add New User" onClose={closeModal}>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Full Name" required>
                <input type="text" value={formFullName} onChange={e => setFormFullName(e.target.value)} required className={inputCls} placeholder="Jane Smith" />
              </Field>
              <Field label="Username" required>
                <input type="text" value={formUsername} onChange={e => setFormUsername(e.target.value)} required className={inputCls} placeholder="jane.smith" />
              </Field>
            </div>
            <Field label="Email">
              <input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} className={inputCls} placeholder="jane@company.com" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Role" required>
                <select value={formRole} onChange={e => setFormRole(e.target.value as UserRole)} required className={inputCls}>
                  <option value="viewer">Viewer</option>
                  <option value="team_lead">Team Lead</option>
                  <option value="manager">Manager</option>
                </select>
              </Field>
              <Field label="Password" required>
                <input type="password" value={formPassword} onChange={e => setFormPassword(e.target.value)} required minLength={6} className={inputCls} placeholder="Min. 6 characters" />
              </Field>
            </div>
            {error && <ErrorMsg>{error}</ErrorMsg>}
            <ModalActions onClose={closeModal} submitLabel="Create User" />
          </form>
        </Modal>
      )}

      {/* Edit User Modal */}
      {modalMode === 'edit' && selectedUser && (
        <Modal title={`Edit User — ${selectedUser.full_name}`} onClose={closeModal}>
          <form onSubmit={handleEdit} className="space-y-4">
            <Field label="Full Name" required>
              <input type="text" value={formFullName} onChange={e => setFormFullName(e.target.value)} required className={inputCls} />
            </Field>
            <Field label="Email">
              <input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Role" required>
              <select value={formRole} onChange={e => setFormRole(e.target.value as UserRole)} className={inputCls}>
                <option value="viewer">Viewer</option>
                <option value="team_lead">Team Lead</option>
                <option value="manager">Manager</option>
              </select>
            </Field>
            {error && <ErrorMsg>{error}</ErrorMsg>}
            <ModalActions onClose={closeModal} submitLabel="Save Changes" />
          </form>
        </Modal>
      )}

      {/* Reset Password Modal */}
      {modalMode === 'reset' && selectedUser && (
        <Modal title={`Reset Password — ${selectedUser.full_name}`} onClose={closeModal}>
          <p className="text-sm text-gray-500 mb-4">
            Set a temporary password. The user will be required to change it on their next login.
          </p>
          <form onSubmit={handleReset} className="space-y-4">
            <Field label="Temporary Password" required>
              <div className="relative">
                <input
                  type={showTempPw ? 'text' : 'password'}
                  value={tempPassword}
                  onChange={e => setTempPassword(e.target.value)}
                  required minLength={6}
                  className={inputCls + ' pr-10'}
                  placeholder="Min. 6 characters"
                />
                <button type="button" onClick={() => setShowTempPw(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showTempPw ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  )}
                </button>
              </div>
            </Field>
            {error && <ErrorMsg>{error}</ErrorMsg>}
            <ModalActions onClose={closeModal} submitLabel="Set Temporary Password" submitColor="amber" />
          </form>
        </Modal>
      )}
    </div>
  );
}

// ── Small helper components ──────────────────────────────────────────────────

const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent';

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function ErrorMsg({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
      <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      {children}
    </div>
  );
}

function ModalActions({ onClose, submitLabel, submitColor = 'indigo' }: { onClose: () => void; submitLabel: string; submitColor?: string }) {
  const colorCls = submitColor === 'amber'
    ? 'bg-amber-500 hover:bg-amber-600 text-white'
    : 'bg-indigo-600 hover:bg-indigo-700 text-white';
  return (
    <div className="flex justify-end gap-3 pt-2">
      <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
        Cancel
      </button>
      <button type="submit" className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${colorCls}`}>
        {submitLabel}
      </button>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
