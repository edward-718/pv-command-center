import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useStore, roleCan } from '@/store/useStore';
import { Layout } from '@/components/Layout';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ProjectsPage } from '@/pages/ProjectsPage';
import { ProjectDetailPage } from '@/pages/ProjectDetailPage';
import { NewProjectPage } from '@/pages/NewProjectPage';
import { TaskDetailPage } from '@/pages/TaskDetailPage';
import { TemplatesPage } from '@/pages/TemplatesPage';
import { AuditPage } from '@/pages/AuditPage';
import { AIPage } from '@/pages/AIPage';
import { VendorsPage } from '@/pages/VendorsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { NotificationsPage } from '@/pages/NotificationsPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const me = useStore((s) => s.currentUser);
  if (!me) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AuditRoute({ children }: { children: React.ReactNode }) {
  const me = useStore((s) => s.currentUser);
  if (!me) return <Navigate to="/login" replace />;
  if (!roleCan(me.role, 'view_audit')) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function TemplateRoute({ children }: { children: React.ReactNode }) {
  const me = useStore((s) => s.currentUser);
  if (!me) return <Navigate to="/login" replace />;
  if (me.role !== 'PM' && me.role !== 'ADMIN' && me.role !== 'PROCESSOR') return <Navigate to="/" replace />;
  return <>{children}</>;
}

function SettingsRoute({ children }: { children: React.ReactNode }) {
  const me = useStore((s) => s.currentUser);
  if (!me) return <Navigate to="/login" replace />;
  if (me.role !== 'ADMIN') return <Navigate to="/" replace />;
  return <>{children}</>;
}

function VendorRoute({ children }: { children: React.ReactNode }) {
  const me = useStore((s) => s.currentUser);
  if (!me) return <Navigate to="/login" replace />;
  if (me.role !== 'PM' && me.role !== 'VENDOR' && me.role !== 'ADMIN') return <Navigate to="/" replace />;
  return <>{children}</>;
}

// Bug8修复: 新建项目路由权限守卫
function CreateProjectRoute({ children }: { children: React.ReactNode }) {
  const me = useStore((s) => s.currentUser);
  if (!me) return <Navigate to="/login" replace />;
  if (!roleCan(me.role, 'create_project')) return <Navigate to="/projects" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/new" element={<CreateProjectRoute><NewProjectPage /></CreateProjectRoute>} />
          <Route path="projects/:id" element={<ProjectDetailPage />} />
          <Route path="tasks/:id" element={<TaskDetailPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="templates" element={<TemplateRoute><TemplatesPage /></TemplateRoute>} />
          <Route path="audit" element={<AuditRoute><AuditPage /></AuditRoute>} />
          <Route path="ai" element={<AIPage />} />
          <Route path="vendors" element={<VendorRoute><VendorsPage /></VendorRoute>} />
          <Route path="settings" element={<SettingsRoute><SettingsPage /></SettingsRoute>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
