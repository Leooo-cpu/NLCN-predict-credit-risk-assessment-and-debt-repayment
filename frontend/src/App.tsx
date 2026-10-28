import type { ReactElement } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { Layout } from "./components/Layout";
import { Loading } from "./components/Loading";
import { CustomersPage } from "./pages/CustomersPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LoanDetailPage } from "./pages/LoanDetailPage";
import { LoanFormPage } from "./pages/LoanFormPage";
import { LoansPage } from "./pages/LoansPage";
import { LoginPage } from "./pages/LoginPage";
import { ModelsPage } from "./pages/ModelsPage";
import { PredictionHistoryPage } from "./pages/PredictionHistoryPage";
import { RiskAssessmentResultPage } from "./pages/RiskAssessmentResultPage";
import { UsersPage } from "./pages/UsersPage";

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
  if (user?.role === "RISK_VIEWER") return <Navigate to="/loans" replace />;
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
        <Route index element={<DashboardPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="loans" element={<LoansPage />} />
        <Route
          path="loans/new"
          element={
            <WriterOnly>
              <LoanFormPage />
            </WriterOnly>
          }
        />
        <Route path="loans/:id" element={<LoanDetailPage />} />
        <Route path="loans/:id/result" element={<RiskAssessmentResultPage />} />
        <Route path="risk-assessment" element={<RiskAssessmentResultPage />} />
        <Route path="predictions" element={<PredictionHistoryPage />} />
        <Route
          path="loans/:id/edit"
          element={
            <WriterOnly>
              <LoanFormPage />
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
