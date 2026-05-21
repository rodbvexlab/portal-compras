import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../helpers/useAuth";
import { User } from "../helpers/User";
import { getRolesForAccessGroups, normalizeUserRole } from "../helpers/accessGroups";
import { AuthErrorPage } from "./AuthErrorPage";
import { ShieldOff } from "lucide-react";
import { AuthLoadingState } from "./AuthLoadingState";
import styles from "./ProtectedRoute.module.css";

// Do not use this in pageLayout
const MakeProtectedRoute: (roles: User["role"][]) => React.FC<{
  children: React.ReactNode;
}> =
  (roles) =>
  ({ children }) => {
    const { authState } = useAuth();
    const location = useLocation();

    // Show loading state while checking authentication
    if (authState.type === "loading") {
      return <AuthLoadingState title="Autenticando" />;
    }

    // Redirect to login if not authenticated
    if (authState.type === "unauthenticated") {
      return <Navigate to="/login" replace />;
    }

    if (
      authState.passwordChangeRequired &&
      location.pathname !== "/trocar-senha"
    ) {
      return <Navigate to="/trocar-senha" replace />;
    }

    if (
      !authState.passwordChangeRequired &&
      location.pathname === "/trocar-senha"
    ) {
      return <Navigate to="/" replace />;
    }

    const normalizedRole = normalizeUserRole(authState.user.role);

    if (!normalizedRole || !roles.includes(normalizedRole)) {
      return (
        <AuthErrorPage
          title="Acesso Negado"
          message={`Acesso negado. Sua função (${authState.user.role}) não possui as permissões necessárias.`}
          icon={<ShieldOff className={styles.accessDeniedIcon} size={64} />}
        />
      );
    }

    // Render children if authenticated
    return <>{children}</>;
  };

// Create protected routes here, then import them in pageLayout
export const LiderRoute = MakeProtectedRoute(
  getRolesForAccessGroups("lider")
);

export const DiretoriaRoute = MakeProtectedRoute(
  getRolesForAccessGroups("diretoria")
);

export const DiretoriaOuAdminRoute = MakeProtectedRoute([
  ...getRolesForAccessGroups("diretoria"),
  "admin",
]);

export const TecnologiaRoute = MakeProtectedRoute(
  getRolesForAccessGroups("tecnologia")
);

export const LiderOuDiretoriaRoute = MakeProtectedRoute(
  getRolesForAccessGroups("lider", "diretoria")
);

export const DiretoriaOuTecnologiaRoute = MakeProtectedRoute(
  getRolesForAccessGroups("diretoria", "tecnologia")
);

export const DashboardRoute = MakeProtectedRoute(
  getRolesForAccessGroups("diretoria", "financeiro", "tecnologia")
);

export const SolicitacoesReadRoute = MakeProtectedRoute(
  getRolesForAccessGroups("financeiro", "tecnologia")
);

export const FinanceiroRoute = MakeProtectedRoute(
  getRolesForAccessGroups("financeiro")
);

export const AdminRoute = MakeProtectedRoute(["admin"]);

export const AllAuthenticatedRoute = MakeProtectedRoute([
  ...getRolesForAccessGroups("lider", "diretoria", "financeiro", "tecnologia"),
]);

export const LiderSetorRoute = LiderRoute;

// Kept for backward compatibility
export const UserRoute = AllAuthenticatedRoute;
