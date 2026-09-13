import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { listenAuthState, ensureUserProfile } from "./src/services/authService";
import { AppUser, TabType } from "./src/types";
import LoginScreen from "./src/screens/LoginScreen";
import DashboardScreen from "./src/screens/DashboardScreen";
import RankingScreen from "./src/screens/RankingScreen";
import PoopcoinsScreen from "./src/screens/PoopcoinsScreen";
import GroupsScreen from "./src/screens/GroupsScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import CuiterScreen from "./src/screens/CuiterScreen";
import AnalyticsScreen from "./src/screens/AnalyticsScreen";
import AdminScreen from "./src/screens/AdminScreen";

function MainApp() {
  const insets = useSafeAreaInsets();
  const [firebaseUser, setFirebaseUser] = useState<any>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState<TabType>("timer");
  const [analyticsMode, setAnalyticsMode] = useState<"metrics" | "history">("metrics");

  const loadUserData = async (fbUser: any) => {
    if (!fbUser) {
      setAppUser(null);
      return;
    }
    try {
      const profile = await ensureUserProfile(fbUser);
      setAppUser(profile);
    } catch (error) {
      console.error("Error loading user profile:", error);
      // Fallback
      setAppUser({
        uid: fbUser.uid,
        name: fbUser.displayName || fbUser.email?.split("@")[0] || "Cagador",
        email: fbUser.email || "",
        totalPoints: 0,
        currentDailyStreak: 0,
        salary: 3000,
        hourlyRate: 3000 / 176,
      });
    }
  };

  useEffect(() => {
    const unsubscribe = listenAuthState(async (user) => {
      setFirebaseUser(user);
      if (user) {
        await loadUserData(user);
      } else {
        setAppUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar style="light" />
        <Text style={styles.loadingLogo}>🚽</Text>
        <ActivityIndicator size="large" color="#eab308" />
        <Text style={styles.loadingText}>Iniciando PrivadIn...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <StatusBar style="light" />

      {!firebaseUser || !appUser ? (
        <LoginScreen
          onSuccess={() => {
            if (firebaseUser) {
              loadUserData(firebaseUser);
            }
          }}
        />
      ) : (
        <View style={styles.mainContainer}>
          {/* Screen Content */}
          <View style={styles.screenContent}>
            {currentTab === "timer" && (
              <DashboardScreen
                user={appUser}
                onRefreshUser={() => loadUserData(firebaseUser)}
                onNavigateToPoopcoins={() => setCurrentTab("poopcoins")}
                onNavigateToCuiter={() => setCurrentTab("cuiter")}
                onNavigateToAnalytics={() => {
                  setAnalyticsMode("metrics");
                  setCurrentTab("analytics");
                }}
                onNavigateToHistory={() => {
                  setAnalyticsMode("history");
                  setCurrentTab("analytics");
                }}
                onNavigateToRanking={() => setCurrentTab("ranking")}
              />
            )}
            {currentTab === "cuiter" && (
              <CuiterScreen
                user={appUser}
                onRefreshUser={() => loadUserData(firebaseUser)}
                onNavigateToPoopcoins={() => setCurrentTab("poopcoins")}
              />
            )}
            {currentTab === "ranking" && (
              <RankingScreen
                currentUserId={appUser.uid}
                currentUser={appUser}
                onNavigateToGroups={() => setCurrentTab("groups")}
                onRefreshUser={() => loadUserData(firebaseUser)}
              />
            )}
            {currentTab === "poopcoins" && (
              <PoopcoinsScreen
                user={appUser}
                onRefreshUser={() => loadUserData(firebaseUser)}
              />
            )}
            {currentTab === "groups" && (
              <GroupsScreen
                user={appUser}
                onRefreshUser={() => loadUserData(firebaseUser)}
              />
            )}
            {currentTab === "analytics" && (
              <AnalyticsScreen
                user={appUser}
                onRefreshUser={() => loadUserData(firebaseUser)}
                onBack={() => setCurrentTab("timer")}
                initialMode={analyticsMode}
              />
            )}
            {currentTab === "profile" && (
              <ProfileScreen
                user={appUser}
                onRefreshUser={() => loadUserData(firebaseUser)}
                onNavigateToPoopcoins={() => setCurrentTab("poopcoins")}
                onNavigateToAnalytics={() => {
                  setAnalyticsMode("metrics");
                  setCurrentTab("analytics");
                }}
                onNavigateToAdmin={() => setCurrentTab("admin")}
              />
            )}
            {currentTab === "admin" && (
              <AdminScreen
                user={appUser}
                onBack={() => setCurrentTab("profile")}
                onRefreshUser={() => loadUserData(firebaseUser)}
              />
            )}
          </View>

          {/* Bottom Tab Bar with Safe Inset */}
          <View
            style={[
              styles.tabBar,
              { paddingBottom: Math.max(insets.bottom, 10) },
            ]}
          >
            <TouchableOpacity
              style={[styles.tabItem, currentTab === "timer" && styles.tabItemActive]}
              onPress={() => setCurrentTab("timer")}
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
              style={[styles.tabItem, currentTab === "cuiter" && styles.tabItemActive]}
              onPress={() => setCurrentTab("cuiter")}
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
              style={[styles.tabItem, currentTab === "ranking" && styles.tabItemActive]}
              onPress={() => setCurrentTab("ranking")}
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
              style={[styles.tabItem, currentTab === "poopcoins" && styles.tabItemActive]}
              onPress={() => setCurrentTab("poopcoins")}
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
              style={[styles.tabItem, currentTab === "groups" && styles.tabItemActive]}
              onPress={() => setCurrentTab("groups")}
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
              style={[styles.tabItem, currentTab === "analytics" && styles.tabItemActive]}
              onPress={() => setCurrentTab("analytics")}
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
              style={[styles.tabItem, currentTab === "profile" && styles.tabItemActive]}
              onPress={() => setCurrentTab("profile")}
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

            {appUser.role === "admin" && (
              <TouchableOpacity
                style={[styles.tabItem, currentTab === "admin" && styles.tabItemActive]}
                onPress={() => setCurrentTab("admin")}
              >
                <Text style={styles.tabIcon}>🛡️</Text>
                <Text
                  style={[
                    styles.tabLabel,
                    currentTab === "admin" && styles.tabLabelActive,
                    { color: currentTab === "admin" ? "#eab308" : "#94a3b8" },
                  ]}
                >
                  Admin
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <MainApp />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#020617",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#020617",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingLogo: {
    fontSize: 50,
    marginBottom: 20,
  },
  loadingText: {
    color: "#94a3b8",
    fontSize: 14,
    marginTop: 14,
    fontWeight: "600",
  },
  mainContainer: {
    flex: 1,
    backgroundColor: "#020617",
  },
  screenContent: {
    flex: 1,
  },
  tabBar: {
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
    minWidth: 40,
  },
  tabItemActive: {
    backgroundColor: "rgba(234, 179, 8, 0.12)",
  },
  tabIcon: {
    fontSize: 19,
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
});
