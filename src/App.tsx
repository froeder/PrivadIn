import { useMemo, useState } from "react";
import { Toaster } from "react-hot-toast";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import {
  useAdminAuditLogs,
  useAllLogs,
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
import type { AppView } from "./types";

function AppContent() {
  const { user, loading } = useAuth();
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

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-950 text-center text-slate-100">
        <div>
          <div className="mx-auto mb-4 h-16 w-16 animate-bounce rounded-3xl bg-yellow-300 text-5xl">🚽</div>
          <p className="font-black">Preparando o assento...</p>
        </div>
      </div>
    );
  }

  if (!liveUser) return <LoginPage />;

  return (
    <Shell view={view} onViewChange={setView} muted={muted} onToggleMuted={toggleMuted}>
      {view === "dashboard" ? (
        <DashboardPage user={liveUser} rankedUsers={rankedUsers} userLogs={userLogs} onPlaySound={playFlush} />
      ) : null}
      {view === "history" ? <HistoryPage logs={userLogs} /> : null}
      {view === "stats" ? <StatsPage user={liveUser} logs={userLogs} allLogs={allLogs} rankedUsers={rankedUsers} /> : null}
      {view === "admin" && liveUser.role === "admin" ? (
        <AdminPage
          admin={liveUser}
          users={users}
          logs={allLogs}
          auditLogs={adminAuditLogs}
          registrationRequests={registrationRequests}
        />
      ) : null}
    </Shell>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "#0f172a",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "#f8fafc",
          },
        }}
      />
    </AuthProvider>
  );
}
