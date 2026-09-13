import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  ScrollView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Menu,
  X,
  Bell,
  Volume2,
  VolumeX,
  Sun,
  Moon,
  LogOut,
  Shield,
  User as UserIcon,
  BarChart3,
  Coins,
  Users,
  MessageCircle,
  LayoutDashboard,
  Trophy,
} from "lucide-react-native";
import type { AppUser, TabType } from "../types";
import { toRoman } from "../utils/roman";
import { signOutUser } from "../services/authService";
import { useSound } from "../hooks/useSound";
import { useTheme } from "../hooks/useTheme";
import { usePoopNotifications } from "../hooks/usePoopNotifications";
import UserAvatar from "./UserAvatar";
import NotificationCenter from "./NotificationCenter";

export interface ShellProps {
  currentUser: AppUser | null;
  currentTab: TabType;
  onTabChange: (tab: TabType) => void;
  onRefreshUser?: () => void;
  edition?: number;
  children: React.ReactNode;
}

export default function Shell({
  currentUser,
  currentTab,
  onTabChange,
  onRefreshUser,
  edition = 1,
  children,
}: ShellProps) {
  const insets = useSafeAreaInsets();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // Sound hook
  const { muted, toggleMuted } = useSound();

  // Theme hook
  const { resolvedTheme, toggleTheme } = useTheme();

  // Real-time Poop Notifications
  const {
    notifications,
    unreadCount,
    markAllAsRead,
    clearNotifications,
    permission,
    requestNotificationPermission,
  } = usePoopNotifications(currentUser);

  const handleLogout = async () => {
    setDrawerOpen(false);
    try {
      await signOutUser();
    } catch (err) {
      console.warn("Error logging out:", err);
    }
  };

  const handleNavClick = (tab: TabType) => {
    onTabChange(tab);
    setDrawerOpen(false);
  };

  const isAdmin = currentUser?.role === "admin";
  const poopcoins = currentUser?.poopcoinBalance ?? 0;

  return (
    <View style={styles.container}>
      {/* ----------------- TOPBAR ----------------- */}
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 8) }]}>
        {/* Left: Drawer Toggle */}
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => setDrawerOpen(true)}
          activeOpacity={0.7}
        >
          <Menu size={20} color="#f8fafc" />
        </TouchableOpacity>

        {/* Center: Brand & Edition */}
        <TouchableOpacity
          style={styles.brandRow}
          onPress={() => onTabChange("timer")}
          activeOpacity={0.8}
        >
          <Text style={styles.brandLogo}>🚽</Text>
          <View>
            <View style={styles.brandTitleRow}>
              <Text style={styles.brandTitle}>PrivadIn</Text>
              <View style={styles.editionBadge}>
                <Text style={styles.editionBadgeText}>
                  Ed. {toRoman(edition)}
                </Text>
              </View>
            </View>
            <Text style={styles.brandTagline}>Campeonato do Trono</Text>
          </View>
        </TouchableOpacity>

        {/* Right Actions: Poopcoins Pill, Sound, Bell, Avatar */}
        <View style={styles.topRightActions}>
          {/* Poopcoins Pill */}
          <TouchableOpacity
            style={styles.poopcoinPill}
            onPress={() => onTabChange("poopcoins")}
            activeOpacity={0.7}
          >
            <Text style={styles.poopcoinPillIcon}>🪙</Text>
            <Text style={styles.poopcoinPillText}>
              {poopcoins.toLocaleString("pt-BR")}
            </Text>
          </TouchableOpacity>

          {/* Sound Toggle */}
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={toggleMuted}
            activeOpacity={0.7}
          >
            {muted ? (
              <VolumeX size={18} color="#ef4444" />
            ) : (
              <Volume2 size={18} color="#eab308" />
            )}
          </TouchableOpacity>

          {/* Notification Bell */}
          <TouchableOpacity
            style={[
              styles.iconBtn,
              unreadCount > 0 && styles.iconBtnNotificationActive,
            ]}
            onPress={() => {
              setNotificationsOpen(true);
              if (unreadCount > 0) {
                markAllAsRead();
              }
            }}
            activeOpacity={0.7}
          >
            <Bell size={18} color={unreadCount > 0 ? "#eab308" : "#94a3b8"} />
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* User Avatar */}
          {currentUser && (
            <TouchableOpacity
              onPress={() => onTabChange("profile")}
              activeOpacity={0.8}
            >
              <UserAvatar
                avatar={currentUser.avatar}
                badge={currentUser.equippedBadge}
                name={currentUser.name}
                size={34}
                borderColor="#eab308"
                borderWidth={1.5}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ----------------- SCREEN CONTENT ----------------- */}
      <View style={styles.content}>{children}</View>

      {/* ----------------- BOTTOM BAR ----------------- */}
      <View
        style={[
          styles.bottomBar,
          { paddingBottom: Math.max(insets.bottom, 10) },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.tabItem,
            currentTab === "timer" && styles.tabItemActive,
          ]}
          onPress={() => onTabChange("timer")}
          activeOpacity={0.7}
        >
          <Text style={styles.tabIcon}>🚽</Text>
          <Text
            style={[
              styles.tabLabel,
              currentTab === "timer" && styles.tabLabelActive,
            ]}
          >
            Trono
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabItem,
            currentTab === "cuiter" && styles.tabItemActive,
          ]}
          onPress={() => onTabChange("cuiter")}
          activeOpacity={0.7}
        >
          <Text style={styles.tabIcon}>🐦</Text>
          <Text
            style={[
              styles.tabLabel,
              currentTab === "cuiter" && styles.tabLabelActive,
            ]}
          >
            Cuiter
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabItem,
            currentTab === "ranking" && styles.tabItemActive,
          ]}
          onPress={() => onTabChange("ranking")}
          activeOpacity={0.7}
        >
          <Text style={styles.tabIcon}>🏆</Text>
          <Text
            style={[
              styles.tabLabel,
              currentTab === "ranking" && styles.tabLabelActive,
            ]}
          >
            Ranking
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabItem,
            currentTab === "poopcoins" && styles.tabItemActive,
          ]}
          onPress={() => onTabChange("poopcoins")}
          activeOpacity={0.7}
        >
          <Text style={styles.tabIcon}>🪙</Text>
          <Text
            style={[
              styles.tabLabel,
              currentTab === "poopcoins" && styles.tabLabelActive,
            ]}
          >
            Moedas
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabItem,
            currentTab === "groups" && styles.tabItemActive,
          ]}
          onPress={() => onTabChange("groups")}
          activeOpacity={0.7}
        >
          <Text style={styles.tabIcon}>🏢</Text>
          <Text
            style={[
              styles.tabLabel,
              currentTab === "groups" && styles.tabLabelActive,
            ]}
          >
            Ligas
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabItem,
            currentTab === "analytics" && styles.tabItemActive,
          ]}
          onPress={() => onTabChange("analytics")}
          activeOpacity={0.7}
        >
          <Text style={styles.tabIcon}>📊</Text>
          <Text
            style={[
              styles.tabLabel,
              currentTab === "analytics" && styles.tabLabelActive,
            ]}
          >
            Stats
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabItem,
            currentTab === "profile" && styles.tabItemActive,
          ]}
          onPress={() => onTabChange("profile")}
          activeOpacity={0.7}
        >
          <Text style={styles.tabIcon}>👤</Text>
          <Text
            style={[
              styles.tabLabel,
              currentTab === "profile" && styles.tabLabelActive,
            ]}
          >
            Perfil
          </Text>
        </TouchableOpacity>

        {isAdmin && (
          <TouchableOpacity
            style={[
              styles.tabItem,
              currentTab === "admin" && styles.tabItemActive,
            ]}
            onPress={() => onTabChange("admin")}
            activeOpacity={0.7}
          >
            <Text style={styles.tabIcon}>🛡️</Text>
            <Text
              style={[
                styles.tabLabel,
                currentTab === "admin" && styles.tabLabelActive,
              ]}
            >
              Admin
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ----------------- DRAWER MODAL (MENU LATERAL) ----------------- */}
      <Modal
        visible={drawerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDrawerOpen(false)}
      >
        <View style={styles.drawerOverlay}>
          <TouchableOpacity
            style={styles.drawerBackdrop}
            activeOpacity={1}
            onPress={() => setDrawerOpen(false)}
          />

          <View style={styles.drawerContent}>
            {/* Drawer Header */}
            <View
              style={[
                styles.drawerHeader,
                { paddingTop: Math.max(insets.top, 16) },
              ]}
            >
              <View style={styles.drawerUserRow}>
                {currentUser && (
                  <UserAvatar
                    avatar={currentUser.avatar}
                    badge={currentUser.equippedBadge}
                    name={currentUser.name}
                    size={48}
                    borderColor="#eab308"
                    borderWidth={2}
                  />
                )}
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.drawerUserName} numberOfLines={1}>
                    {currentUser?.name || "Cagador"}
                  </Text>
                  <Text style={styles.drawerUserEmail} numberOfLines={1}>
                    {currentUser?.email || ""}
                  </Text>
                  <View style={styles.roleTag}>
                    <Text style={styles.roleTagText}>
                      {isAdmin ? "🛡️ Administrador" : "🚽 Competidor Oficial"}
                    </Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                style={styles.drawerCloseBtn}
                onPress={() => setDrawerOpen(false)}
                activeOpacity={0.7}
              >
                <X size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            {/* Quick Balance Cards */}
            <View style={styles.drawerBalancesRow}>
              <View style={styles.drawerBalanceCard}>
                <Text style={styles.drawerBalanceLabel}>Poopcoins</Text>
                <Text style={styles.drawerBalanceVal}>
                  🪙 {poopcoins.toLocaleString("pt-BR")}
                </Text>
              </View>
              <View style={styles.drawerBalanceCard}>
                <Text style={styles.drawerBalanceLabel}>Pontos Totais</Text>
                <Text style={styles.drawerBalanceVal}>
                  🏆 {(currentUser?.totalPoints ?? 0).toLocaleString("pt-BR")}
                </Text>
              </View>
            </View>

            {/* Drawer Navigation List */}
            <ScrollView
              style={styles.drawerNavScroll}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.drawerSectionTitle}>NAVEGAÇÃO</Text>

              <TouchableOpacity
                style={[
                  styles.drawerNavItem,
                  currentTab === "timer" && styles.drawerNavItemActive,
                ]}
                onPress={() => handleNavClick("timer")}
              >
                <LayoutDashboard size={18} color={currentTab === "timer" ? "#020617" : "#cbd5e1"} />
                <Text
                  style={[
                    styles.drawerNavText,
                    currentTab === "timer" && styles.drawerNavTextActive,
                  ]}
                >
                  Trono (Cronômetro)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.drawerNavItem,
                  currentTab === "cuiter" && styles.drawerNavItemActive,
                ]}
                onPress={() => handleNavClick("cuiter")}
              >
                <MessageCircle size={18} color={currentTab === "cuiter" ? "#020617" : "#cbd5e1"} />
                <Text
                  style={[
                    styles.drawerNavText,
                    currentTab === "cuiter" && styles.drawerNavTextActive,
                  ]}
                >
                  Cuiter (Rede Social)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.drawerNavItem,
                  currentTab === "ranking" && styles.drawerNavItemActive,
                ]}
                onPress={() => handleNavClick("ranking")}
              >
                <Trophy size={18} color={currentTab === "ranking" ? "#020617" : "#cbd5e1"} />
                <Text
                  style={[
                    styles.drawerNavText,
                    currentTab === "ranking" && styles.drawerNavTextActive,
                  ]}
                >
                  Ranking & Pódio
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.drawerNavItem,
                  currentTab === "poopcoins" && styles.drawerNavItemActive,
                ]}
                onPress={() => handleNavClick("poopcoins")}
              >
                <Coins size={18} color={currentTab === "poopcoins" ? "#020617" : "#cbd5e1"} />
                <Text
                  style={[
                    styles.drawerNavText,
                    currentTab === "poopcoins" && styles.drawerNavTextActive,
                  ]}
                >
                  Poopcoins & Carteira
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.drawerNavItem,
                  currentTab === "groups" && styles.drawerNavItemActive,
                ]}
                onPress={() => handleNavClick("groups")}
              >
                <Users size={18} color={currentTab === "groups" ? "#020617" : "#cbd5e1"} />
                <Text
                  style={[
                    styles.drawerNavText,
                    currentTab === "groups" && styles.drawerNavTextActive,
                  ]}
                >
                  Ligas & Grupos
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.drawerNavItem,
                  currentTab === "analytics" && styles.drawerNavItemActive,
                ]}
                onPress={() => handleNavClick("analytics")}
              >
                <BarChart3 size={18} color={currentTab === "analytics" ? "#020617" : "#cbd5e1"} />
                <Text
                  style={[
                    styles.drawerNavText,
                    currentTab === "analytics" && styles.drawerNavTextActive,
                  ]}
                >
                  Estatísticas & Histórico
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.drawerNavItem,
                  currentTab === "profile" && styles.drawerNavItemActive,
                ]}
                onPress={() => handleNavClick("profile")}
              >
                <UserIcon size={18} color={currentTab === "profile" ? "#020617" : "#cbd5e1"} />
                <Text
                  style={[
                    styles.drawerNavText,
                    currentTab === "profile" && styles.drawerNavTextActive,
                  ]}
                >
                  Editar Perfil & Jornada
                </Text>
              </TouchableOpacity>

              {isAdmin && (
                <TouchableOpacity
                  style={[
                    styles.drawerNavItem,
                    currentTab === "admin" && styles.drawerNavItemActive,
                  ]}
                  onPress={() => handleNavClick("admin")}
                >
                  <Shield size={18} color={currentTab === "admin" ? "#020617" : "#eab308"} />
                  <Text
                    style={[
                      styles.drawerNavText,
                      currentTab === "admin" && styles.drawerNavTextActive,
                      { color: currentTab === "admin" ? "#020617" : "#eab308" },
                    ]}
                  >
                    Painel da Diretoria (Admin)
                  </Text>
                </TouchableOpacity>
              )}

              {/* Preferences Section */}
              <Text style={[styles.drawerSectionTitle, { marginTop: 20 }]}>
                PREFERÊNCIAS & SISTEMA
              </Text>

              {/* Theme Toggle */}
              <TouchableOpacity
                style={styles.drawerActionRow}
                onPress={toggleTheme}
                activeOpacity={0.7}
              >
                <View style={styles.drawerActionLeft}>
                  {resolvedTheme === "dark" ? (
                    <Moon size={18} color="#eab308" />
                  ) : (
                    <Sun size={18} color="#eab308" />
                  )}
                  <Text style={styles.drawerActionText}>Modo de Exibição</Text>
                </View>
                <Text style={styles.drawerActionBadge}>
                  {resolvedTheme === "dark" ? "🌙 Escuro" : "☀️ Claro"}
                </Text>
              </TouchableOpacity>

              {/* Sound Toggle */}
              <TouchableOpacity
                style={styles.drawerActionRow}
                onPress={toggleMuted}
                activeOpacity={0.7}
              >
                <View style={styles.drawerActionLeft}>
                  {muted ? (
                    <VolumeX size={18} color="#ef4444" />
                  ) : (
                    <Volume2 size={18} color="#10b981" />
                  )}
                  <Text style={styles.drawerActionText}>Efeitos Sonoros</Text>
                </View>
                <Text
                  style={[
                    styles.drawerActionBadge,
                    { color: muted ? "#ef4444" : "#10b981" },
                  ]}
                >
                  {muted ? "Mudo" : "Ativado"}
                </Text>
              </TouchableOpacity>

              {/* Logout Button */}
              <TouchableOpacity
                style={styles.logoutBtn}
                onPress={handleLogout}
                activeOpacity={0.7}
              >
                <LogOut size={18} color="#ef4444" />
                <Text style={styles.logoutBtnText}>Sair da Conta</Text>
              </TouchableOpacity>

              <Text style={styles.drawerFooterVersion}>
                PrivadIn Mobile • Edição Oficial {toRoman(edition)}
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ----------------- NOTIFICATION CENTER ----------------- */}
      <NotificationCenter
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        notifications={notifications}
        unreadCount={unreadCount}
        onMarkAllAsRead={markAllAsRead}
        onClearNotifications={clearNotifications}
        permission={permission}
        onRequestPermission={requestNotificationPermission}
        onSelectNotification={(item) => {
          setNotificationsOpen(false);
          if (item.type === "cuiter") {
            onTabChange("cuiter");
          } else if (item.type === "poopcoin") {
            onTabChange("poopcoins");
          } else {
            onTabChange("ranking");
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#020617",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0f172a",
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
    zIndex: 10,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    marginLeft: 6,
  },
  brandLogo: {
    fontSize: 24,
  },
  brandTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  brandTitle: {
    color: "#f8fafc",
    fontSize: 16,
    fontWeight: "900",
  },
  editionBadge: {
    backgroundColor: "rgba(234, 179, 8, 0.2)",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.4)",
  },
  editionBadgeText: {
    color: "#eab308",
    fontSize: 9,
    fontWeight: "900",
  },
  brandTagline: {
    color: "#64748b",
    fontSize: 9,
    fontWeight: "600",
  },
  topRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#1e293b",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  iconBtnNotificationActive: {
    borderColor: "rgba(234, 179, 8, 0.4)",
    borderWidth: 1,
  },
  unreadBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#eab308",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  unreadBadgeText: {
    color: "#020617",
    fontSize: 9,
    fontWeight: "900",
  },
  poopcoinPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(234, 179, 8, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.3)",
    gap: 4,
  },
  poopcoinPillIcon: {
    fontSize: 12,
  },
  poopcoinPillText: {
    color: "#eab308",
    fontSize: 11,
    fontWeight: "800",
  },
  content: {
    flex: 1,
  },
  bottomBar: {
    flexDirection: "row",
    backgroundColor: "#0f172a",
    borderTopWidth: 1,
    borderTopColor: "#1e293b",
    paddingVertical: 6,
    paddingHorizontal: 4,
    justifyContent: "space-around",
  },
  tabItem: {
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 2,
    borderRadius: 10,
    minWidth: 38,
  },
  tabItemActive: {
    backgroundColor: "rgba(234, 179, 8, 0.12)",
  },
  tabIcon: {
    fontSize: 18,
    marginBottom: 2,
  },
  tabLabel: {
    fontSize: 10,
    color: "#64748b",
    fontWeight: "600",
  },
  tabLabelActive: {
    color: "#eab308",
    fontWeight: "800",
  },
  drawerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    flexDirection: "row",
  },
  drawerBackdrop: {
    ...StyleSheet.absoluteFill,
  },
  drawerContent: {
    width: "82%",
    maxWidth: 340,
    backgroundColor: "#0f172a",
    borderRightWidth: 1,
    borderRightColor: "#1e293b",
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  drawerHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  drawerUserRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  drawerUserName: {
    color: "#f8fafc",
    fontSize: 15,
    fontWeight: "800",
  },
  drawerUserEmail: {
    color: "#94a3b8",
    fontSize: 11,
    marginTop: 1,
  },
  roleTag: {
    marginTop: 4,
    alignSelf: "flex-start",
    backgroundColor: "#1e293b",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleTagText: {
    color: "#eab308",
    fontSize: 9,
    fontWeight: "700",
  },
  drawerCloseBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "#1e293b",
  },
  drawerBalancesRow: {
    flexDirection: "row",
    gap: 8,
    marginVertical: 14,
  },
  drawerBalanceCard: {
    flex: 1,
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#334155",
  },
  drawerBalanceLabel: {
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: "600",
  },
  drawerBalanceVal: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 2,
  },
  drawerNavScroll: {
    flex: 1,
  },
  drawerSectionTitle: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 4,
  },
  drawerNavItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 4,
  },
  drawerNavItemActive: {
    backgroundColor: "#eab308",
  },
  drawerNavText: {
    color: "#cbd5e1",
    fontSize: 13,
    fontWeight: "700",
  },
  drawerNavTextActive: {
    color: "#020617",
    fontWeight: "900",
  },
  drawerActionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1e293b",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  drawerActionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  drawerActionText: {
    color: "#cbd5e1",
    fontSize: 13,
    fontWeight: "600",
  },
  drawerActionBadge: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "700",
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    marginTop: 14,
    marginBottom: 10,
  },
  logoutBtnText: {
    color: "#ef4444",
    fontSize: 13,
    fontWeight: "800",
  },
  drawerFooterVersion: {
    color: "#475569",
    fontSize: 10,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 20,
  },
});
