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
import Shell from "./src/components/Shell";
import { listenAppSettings } from "./src/services/settingsService";
import { ThemeProvider } from "./src/contexts/ThemeContext";

function MainApp() {
  const [firebaseUser, setFirebaseUser] = useState<any>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [appSettings, setAppSettings] = useState<any>(null);
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
    const unsubscribeAuth = listenAuthState(async (user) => {
      setFirebaseUser(user);
      if (user) {
        await loadUserData(user);
      } else {
        setAppUser(null);
      }
      setLoading(false);
    });

    const unsubscribeSettings = listenAppSettings((settings) => {
      setAppSettings(settings);
    });

    return () => {
      unsubscribeAuth();
      unsubscribeSettings();
    };
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
        <Shell
          currentUser={appUser}
          currentTab={currentTab}
          onTabChange={setCurrentTab}
          onRefreshUser={() => loadUserData(firebaseUser)}
          edition={appSettings?.edition ?? 1}
        >
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
        </Shell>
      )}
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <MainApp />
      </ThemeProvider>
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
});
