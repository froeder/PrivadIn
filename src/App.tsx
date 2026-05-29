import { useMemo, useState } from "react";
import { Toaster } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import {
  useAdminAuditLogs,
  useAllLogs,
  useAppSettings,
  useRegistrationAttempts,
  useRegistrationRequests,
  useUserLogs,
  useUsers,
} from "./hooks/useFirestoreData";
import { useSound } from "./hooks/useSound";
import { Shell } from "./components/Shell";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { HistoryPage } from "./pages/HistoryPage";
import { StatsPage } from "./pages/StatsPage";
import { AdminPage } from "./pages/AdminPage";
import { EditProfilePage } from "./pages/EditProfilePage";
import { CuiterPage } from "./pages/CuiterPage";
import { useTheme } from "./hooks/useTheme";
import type { AppView } from "./types";

function AppContent() {
  const { t } = useTranslation("common");
  const { user, loading } = useAuth();
  const { appSettings } = useAppSettings();
  const { users, rankedUsers } = useUsers(Boolean(user));
  const { logs: userLogs } = useUserLogs(user?.uid);
  const allLogs = useAllLogs(Boolean(user));
  const { muted, toggleMuted, playFlush } = useSound();
  const [view, setView] = useState<AppView>("dashboard");

  const liveUser = useMemo(() => {
    if (!user) return null;
    return users.find((candidate) => candidate.uid === user.uid) ?? user;
  }, [user, users]);
  const adminAuditLogs = useAdminAuditLogs(liveUser?.role === "admin");
  const registrationRequests = useRegistrationRequests(liveUser?.role === "admin");
  const registrationAttempts = useRegistrationAttempts(liveUser?.role === "admin");

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-canvas text-center text-fg">
        <div>
          <div className="mx-auto mb-4 grid h-16 w-16 animate-bounce place-items-center rounded-3xl bg-accent text-5xl text-accent-fg shadow-accent">🚽</div>
          <p className="font-black">{t("loading")}</p>
        </div>
      </div>
    );
  }

  if (!liveUser) return <LoginPage cooldownMinutes={appSettings.cooldownMinutes} />;

  return (
    <Shell currentUser={liveUser} view={view} onViewChange={setView} muted={muted} onToggleMuted={toggleMuted}>
      {view === "dashboard" ? (
        <DashboardPage
          user={liveUser}
          rankedUsers={rankedUsers}
          userLogs={userLogs}
          cooldownMinutes={appSettings.cooldownMinutes}
          pointsPerLog={appSettings.pointsPerLog}
          edition={appSettings.edition}
          onPlaySound={playFlush}
        />
      ) : null}
      {view === "profile" ? <EditProfilePage user={liveUser} /> : null}
      {view === "history" ? <HistoryPage logs={userLogs} /> : null}
      {view === "stats" ? <StatsPage user={liveUser} logs={userLogs} allLogs={allLogs} rankedUsers={rankedUsers} /> : null}
      {view === "cuiter" ? <CuiterPage user={liveUser} userLogs={userLogs} /> : null}
      {view === "admin" && liveUser.role === "admin" ? (
        <AdminPage
          admin={liveUser}
          users={users}
          logs={allLogs}
          appSettings={appSettings}
          auditLogs={adminAuditLogs}
          registrationRequests={registrationRequests}
          registrationAttempts={registrationAttempts}
        />
      ) : null}
    </Shell>
  );
}

export default function App() {
  const { resolvedTheme } = useTheme();

  return (
    <AuthProvider>
      <AppContent />
      <Toaster
        position="top-right"
        toastOptions={{
          iconTheme: {
            primary: "rgb(var(--accent))",
            secondary: "rgb(var(--accent-fg))",
          },
          style: {
            background: "rgb(var(--panel-strong) / 0.98)",
            border: "1px solid rgb(var(--line) / 0.12)",
            color: "rgb(var(--fg))",
            boxShadow: "0 18px 48px rgb(var(--shadow-color) / 0.22)",
          },
          success: {
            iconTheme: {
              primary: "rgb(var(--success))",
              secondary: resolvedTheme === "dark" ? "#052e16" : "#ecfdf5",
            },
          },
          error: {
            iconTheme: {
              primary: "rgb(var(--danger))",
              secondary: resolvedTheme === "dark" ? "#450a0a" : "#fef2f2",
            },
          },
        }}
      />
    </AuthProvider>
  );
}
