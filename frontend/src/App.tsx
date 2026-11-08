import type { ReactElement } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { Layout } from "./components/Layout";
import { Loading } from "./components/Loading";
import { LoginPage } from "./pages/LoginPage";
import { ModelsPage } from "./pages/ModelsPage";
import { UsersPage } from "./pages/UsersPage";
import { CreditCaseListPage } from "./pages/CreditCaseListPage";
import { CreditCaseDetailPage, CreditCaseCreatePage } from "./pages/CreditCaseDetailPage";
import { CreditCaseHistoryPage } from "./pages/CreditCaseHistoryPage";
import { CreditDashboardPage } from "./pages/CreditDashboardPage";
import { CreditAssessmentPage } from "./pages/CreditAssessmentPage";

function Private({ children }: { children: ReactElement }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AdminOnly({ children }: { children: ReactElement }) {
  const { user } = useAuth();
  if (user?.role !== "ADMIN") return <Navigate to="/" replace />;
  return children;
}

function WriterOnly({ children }: { children: ReactElement }) {
  const { user } = useAuth();
  if (user?.role !== "ADMIN" && user?.role !== "OFFICER") return <Navigate to="/loans" replace />;
  return children;
}

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <LoginPage />} />
      <Route
        path="/"
        element={
          <Private>
            <Layout />
          </Private>
        }
      >
        <Route index element={<CreditDashboardPage />} />
        <Route path="customers" element={<CreditCaseListPage />} />
        <Route path="customers/new" element={<WriterOnly><CreditCaseCreatePage /></WriterOnly>} />
        <Route path="customers/:id" element={<CreditCaseDetailPage mode="customers" />} />
        <Route path="loans" element={<CreditCaseListPage key="loans" mode="loans" />} />
        <Route
          path="loans/new"
          element={
            <WriterOnly>
              <Navigate to="/customers/new" replace />
            </WriterOnly>
          }
        />
        <Route path="loans/:id" element={<CreditCaseDetailPage />} />
        <Route path="loans/:id/result" element={<CreditCaseDetailPage />} />
        <Route path="risk-assessment" element={<WriterOnly><CreditAssessmentPage /></WriterOnly>} />
        <Route path="risk-assessment/:id" element={<WriterOnly><CreditCaseDetailPage mode="assessment" /></WriterOnly>} />
        <Route path="home-credit" element={<Navigate to="/customers" replace />} />
        <Route path="predictions" element={<CreditCaseHistoryPage />} />
        <Route
          path="loans/:id/edit"
          element={
            <WriterOnly>
              <CreditCaseDetailPage mode="assessment" />
            </WriterOnly>
          }
        />
        <Route path="models" element={<ModelsPage />} />
        <Route
          path="users"
          element={
            <AdminOnly>
              <UsersPage />
            </AdminOnly>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
