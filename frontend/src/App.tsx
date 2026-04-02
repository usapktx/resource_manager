import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import ChangePassword from './pages/ChangePassword';
import Dashboard from './pages/Dashboard';
import Resources from './pages/Resources';
import Projects from './pages/Projects';
import Allocations from './pages/Allocations';
import AIPlanner from './pages/AIPlanner';
import AuditLogPage from './pages/AuditLog';
import UsersPage from './pages/Users';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginRedirect />} />
          <Route path="/change-password" element={<ChangePasswordGuard />} />
          <Route path="/" element={<AuthGuard />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="resources" element={<Resources />} />
            <Route path="projects" element={<Projects />} />
            <Route path="allocations" element={<Allocations />} />
            <Route path="ai-planner" element={<AIPlanner />} />
            <Route path="audit-log" element={<AuditLogPage />} />
            <Route path="users" element={<UsersPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

function Spinner() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full" />
    </div>
  );
}

// /login — redirect to dashboard if already logged in
function LoginRedirect() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <Spinner />;
  if (user) return <Navigate to="/dashboard" replace />;
  return <Login />;
}

// /change-password — only accessible when logged in AND mustChangePassword
function ChangePasswordGuard() {
  const { user, isLoading, mustChangePassword } = useAuth();
  if (isLoading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (!mustChangePassword) return <Navigate to="/dashboard" replace />;
  return <ChangePassword />;
}

// All main app routes — redirect to /login if not authed, /change-password if forced reset
function AuthGuard() {
  const { user, isLoading, mustChangePassword } = useAuth();
  if (isLoading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (mustChangePassword) return <Navigate to="/change-password" replace />;
  return <Layout />;
}
