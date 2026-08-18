import { useEffect, useMemo, useState } from "react";
import { Toaster, toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import {
  useAdminAuditLogs,
  useAllLogs,
  useAppSettings,
  useGroups,
  usePoopcoinSupply,
  usePoopcoinTransactions,
  useRegistrationAttempts,
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
import { UserProfilePage } from "./pages/UserProfilePage";
import { CuiterPage } from "./pages/CuiterPage";
import { PoopcoinsPage } from "./pages/PoopcoinsPage";
import { GroupsPage } from "./pages/GroupsPage";
import { useTheme } from "./hooks/useTheme";
import type { AppView } from "./types";

function AppContent() {
  const { t } = useTranslation("common");
  const { user, loading, logout, currentAppSettings } = useAuth();
  const { appSettings } = useAppSettings();
  const { users, rankedUsers, logs: rankingLogs } = useUsers(Boolean(user));
  const groups = useGroups(Boolean(user));
  const [view, setView] = useState<AppView>("dashboard");
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [previousView, setPreviousView] = useState<AppView>("dashboard");
  const { logs: userLogs } = useUserLogs(
    user?.uid,
    Boolean(user) && view !== "admin" && view !== "profile",
  );
  const allLogs = useAllLogs(view === "stats" || view === "admin");
  const poopcoinTransactions = usePoopcoinTransactions(Boolean(user) && (view === "poopcoins" || view === "admin"));
  const poopcoinSupply = usePoopcoinSupply(Boolean(user) && (view === "poopcoins" || view === "admin"));
  const { muted, toggleMuted, playFlush } = useSound();

  const liveUser = useMemo(() => {
    if (!user) return null;
    return users.find((candidate) => candidate.uid === user.uid) ?? user;
  }, [user, users]);

  const profileUser = useMemo(() => {
    if (!profileUserId) return liveUser;
    return users.find((candidate) => candidate.uid === profileUserId) ?? liveUser;
  }, [profileUserId, users, liveUser]);

  const handleViewProfile = (uid: string) => {
    setPreviousView(view);
    setProfileUserId(uid);
    setView("profile");
  };

  const handleViewChange = (newView: AppView) => {
    if (newView === "profile" && liveUser) {
      setProfileUserId(liveUser.uid);
    }
    setView(newView);
  };

  useEffect(() => {
    if (liveUser?.isActive === false) {
      toast.error(t("auth:deactivated_user"));
      void logout();
    }
  }, [liveUser, logout, t]);

  const adminAuditLogs = useAdminAuditLogs(liveUser?.role === "admin");
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

  if (!liveUser) {
    return (
      <LoginPage
        cooldownMinutes={appSettings.cooldownMinutes}
        appSettings={currentAppSettings ?? appSettings}
      />
    );
  }

  return (
    <Shell currentUser={liveUser} view={view} onViewChange={handleViewChange} muted={muted} onToggleMuted={toggleMuted}>
      {view === "dashboard" ? (
        <DashboardPage
          user={liveUser}
          rankedUsers={rankedUsers}
          userLogs={userLogs}
          cooldownMinutes={appSettings.cooldownMinutes}
          pointsPerLog={appSettings.pointsPerLog}
          poopcoinsPerLog={appSettings.poopcoinsPerLog}
          poopcoinsPerLogUpdatedAt={appSettings.poopcoinsPerLogUpdatedAt}
          edition={appSettings.edition}
          competitionAnnouncement={appSettings.competitionAnnouncement ?? ""}
          onPlaySound={playFlush}
          onOpenProfile={() => handleViewProfile(liveUser.uid)}
          onViewProfile={handleViewProfile}
        />
      ) : null}
      {view === "profile" && profileUser ? (
        <UserProfilePage
          currentUser={liveUser}
          profileUser={profileUser}
          setView={setView}
          onBack={() => setView(previousView)}
        />
      ) : null}
      {view === "edit-profile" ? (
        <EditProfilePage user={liveUser} appSettings={appSettings} setView={setView} />
      ) : null}
      {view === "poopcoins" ? (
        <PoopcoinsPage
          user={liveUser}
          users={users}
          transactions={poopcoinTransactions}
          appSettings={appSettings}
          supply={poopcoinSupply}
        />
      ) : null}
      {view === "groups" ? (
        <GroupsPage
          user={liveUser}
          users={users}
          logs={rankingLogs}
          groups={groups}
          onViewProfile={handleViewProfile}
        />
      ) : null}
      {view === "history" ? <HistoryPage logs={userLogs} /> : null}
      {view === "stats" ? <StatsPage user={liveUser} logs={userLogs} allLogs={allLogs} rankedUsers={rankedUsers} overallRankingVisible={appSettings.overallRankingVisible === true} /> : null}
      {view === "cuiter" ? (
        <CuiterPage
          user={liveUser}
          users={users}
          cuiterPostCost={appSettings.cuiterPostCost}
          onViewProfile={handleViewProfile}
        />
      ) : null}
      {view === "admin" && liveUser.role === "admin" ? (
        <AdminPage
          admin={liveUser}
          users={users}
          logs={allLogs}
          appSettings={appSettings}
          auditLogs={adminAuditLogs}
          registrationAttempts={registrationAttempts}
          groups={groups}
          poopcoinTransactions={poopcoinTransactions}
          poopcoinSupply={poopcoinSupply}
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
