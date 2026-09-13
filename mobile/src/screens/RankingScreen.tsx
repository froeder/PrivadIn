import React, { useState, useEffect, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { AppUser } from "../types";
import { getLeaderboard } from "../services/poopService";
import { formatPoopcoins } from "../services/poopcoinService";
import UserProfileModal from "../components/UserProfileModal";
import TransferPoopcoinsModal from "../components/TransferPoopcoinsModal";
import UserAvatar from "../components/UserAvatar";
import { shareWeeklyRanking } from "../utils/weeklyRankingShare";
import { fetchAppSettings } from "../services/authService";

interface RankingScreenProps {
  currentUserId?: string;
  currentUser?: AppUser;
  onNavigateToGroups?: () => void;
  onRefreshUser?: () => void;
}

type RankingMode = "weekly" | "overall";

function getDaysUntilSunday(): { days: number; hours: number; isLastDay: boolean } {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const daysUntil = day === 0 ? 0 : 7 - day;
  const hoursUntil = 23 - now.getHours();
  return {
    days: daysUntil,
    hours: Math.max(0, hoursUntil),
    isLastDay: day === 0,
  };
}

export default function RankingScreen({
  currentUserId,
  currentUser,
  onNavigateToGroups,
  onRefreshUser,
}: RankingScreenProps) {
  const [mode, setMode] = useState<RankingMode>("weekly");
  const [leaders, setLeaders] = useState<AppUser[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Profile and Tip Modal States
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [tipRecipientUser, setTipRecipientUser] = useState<AppUser | null>(null);
  const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [appSettings, setAppSettings] = useState<any>(null);
  const [sharing, setSharing] = useState(false);

  const countdown = useMemo(() => getDaysUntilSunday(), []);

  useEffect(() => {
    fetchAppSettings()
      .then((settings) => {
        setAppSettings(settings);
        if (settings?.overallRankingVisible === false && mode === "overall") {
          setMode("weekly");
        }
      })
      .catch(console.warn);
  }, []);

  const handleShareRanking = async () => {
    if (sharing || leaders.length === 0) return;
    setSharing(true);
    try {
      await shareWeeklyRanking({
        users: leaders,
        edition: appSettings?.edition || 1,
        currentUserId,
        announcement: appSettings?.competitionAnnouncement,
      });
    } finally {
      setSharing(false);
    }
  };

  const fetchLeaders = async (selectedMode: RankingMode = mode) => {
    setError(null);
    try {
      const data = await getLeaderboard(selectedMode, 60);
      setLeaders(data);
    } catch (err) {
      console.error(err);
      setError("Não foi possível carregar o ranking no momento.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchLeaders(mode);
  }, [mode]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchLeaders(mode);
  };

  const handleOpenProfile = (user: AppUser) => {
    setSelectedUserId(user.uid);
    setProfileModalVisible(true);
  };

  const handleOpenTransfer = (recipient: AppUser) => {
    setTipRecipientUser(recipient);
    setTransferModalVisible(true);
  };

  const getPoints = (user: AppUser) => {
    return (mode === "weekly" ? user.weeklyPoints : user.totalPoints) || 0;
  };

  // Top 3 for podium
  const top1 = leaders[0] || null;
  const top2 = leaders[1] || null;
  const top3 = leaders[2] || null;

  // Filtered list for search
  const filteredLeaders = useMemo(() => {
    if (!searchQuery.trim()) return leaders;
    const query = searchQuery.toLowerCase().trim();
    return leaders.filter(
      (u) =>
        (u.name && u.name.toLowerCase().includes(query)) ||
        (u.nickname && u.nickname.toLowerCase().includes(query))
    );
  }, [leaders, searchQuery]);

  // If searching, runnersUp is all filtered results; otherwise slice(3)
  const isFiltering = searchQuery.trim().length > 0;
  const runnersUp = isFiltering ? filteredLeaders : leaders.slice(3);

  // Current user position in the full list
  const currentUserIndex = useMemo(() => {
    if (!currentUserId) return -1;
    return leaders.findIndex((u) => u.uid === currentUserId);
  }, [leaders, currentUserId]);

  const currentUserData = currentUserIndex >= 0 ? leaders[currentUserIndex] : null;

  // Competition summary stats
  const topScore = leaders.length > 0 ? getPoints(leaders[0]) : 0;
  const maxStreak = useMemo(() => {
    if (leaders.length === 0) return 0;
    return Math.max(...leaders.map((u) => u.currentDailyStreak || 0));
  }, [leaders]);

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#eab308" />
        <Text style={styles.loadingText}>Carregando ranking dos mestres...</Text>
      </View>
    );
  }

  if (error && leaders.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorEmoji}>⚠️</Text>
        <Text style={styles.errorTitle}>Erro ao carregar</Text>
        <Text style={styles.errorSubtitle}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => fetchLeaders(mode)}>
          <Text style={styles.retryButtonText}>Tentar Novamente</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <View style={{ flex: 1, marginRight: 6 }}>
            <Text style={styles.title}>🏆 Hall da Fama</Text>
            <Text style={styles.subtitle}>Os maiores especialistas em cagada remunerada</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <TouchableOpacity
              style={styles.shareHeaderBtn}
              onPress={handleShareRanking}
              disabled={sharing || leaders.length === 0}
              activeOpacity={0.8}
            >
              <Text style={styles.shareHeaderBtnText}>
                {sharing ? "⏳" : "📤 Compartilhar"}
              </Text>
            </TouchableOpacity>
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{leaders.length} no ranking</Text>
            </View>
          </View>
        </View>

        {/* Corporate League Navigation Banner */}
        {onNavigateToGroups && (
          <TouchableOpacity
            style={styles.leagueBanner}
            onPress={onNavigateToGroups}
            activeOpacity={0.8}
          >
            <View style={styles.leagueBannerContent}>
              <Text style={styles.leagueBannerIcon}>🏢</Text>
              <View style={styles.leagueBannerTextCol}>
                <Text style={styles.leagueBannerTitle}>Ligas Corporativas Privadas</Text>
                <Text style={styles.leagueBannerDesc}>Dispute posições na tabela da sua empresa</Text>
              </View>
            </View>
            <Text style={styles.leagueBannerArrow}>➔</Text>
          </TouchableOpacity>
        )}

        {/* Mode Switcher Tabs (visibilidade controlada pelo administrador) */}
        {appSettings?.overallRankingVisible !== false ? (
          <View style={styles.tabSwitcher}>
            <TouchableOpacity
              style={[styles.tabButton, mode === "weekly" && styles.tabButtonActive]}
              onPress={() => setMode("weekly")}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabButtonText, mode === "weekly" && styles.tabButtonTextActive]}>
                ⚡ Rodada Semanal
              </Text>
              {mode === "weekly" && <View style={styles.activeDot} />}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, mode === "overall" && styles.tabButtonActive]}
              onPress={() => setMode("overall")}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabButtonText, mode === "overall" && styles.tabButtonTextActive]}>
                👑 Geral Histórico
              </Text>
              {mode === "overall" && <View style={styles.activeDot} />}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.tabSwitcherSingle}>
            <View style={styles.tabButtonSingle}>
              <Text style={styles.tabButtonTextActive}>
                ⚡ Rodada Semanal Oficial
              </Text>
              <View style={styles.activeDot} />
            </View>
          </View>
        )}

        {/* Mode Countdown & Context Ribbon */}
        <View style={styles.countdownRibbon}>
          {mode === "weekly" ? (
            <Text style={styles.countdownText}>
              ⏳{" "}
              {countdown.isLastDay
                ? "Último dia da rodada! Reset às 23:59"
                : `Reset em ${countdown.days} dia${countdown.days > 1 ? "s" : ""} • Domingo 23:59`}
            </Text>
          ) : (
            <Text style={styles.countdownText}>
              ⭐ Carreira Acumulada • Toda a história de cagadas registradas
            </Text>
          )}
        </View>

        {/* Metrics Mini Dashboard */}
        <View style={styles.metricsRow}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>LÍDER</Text>
            <Text style={styles.metricValueGold}>{formatPoopcoins(topScore)} pts</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>COMPETIDORES</Text>
            <Text style={styles.metricValue}>{leaders.length} ativos</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>MAIOR STREAK</Text>
            <Text style={styles.metricValueOrange}>🔥 {maxStreak}d</Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBarContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar colega pelo nome..."
            placeholderTextColor="#64748b"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")} style={styles.clearSearchBtn}>
              <Text style={styles.clearSearchText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Main Ranking List */}
      <FlatList
        data={runnersUp}
        keyExtractor={(item) => item.uid}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#eab308" />
        }
        ListHeaderComponent={
          <View>
            {/* Podium Section (Top 1, 2 e 3) - Only shown when not searching */}
            {!isFiltering && leaders.length > 0 && (
              <View style={styles.podiumSection}>
                <View style={styles.podiumHeaderRow}>
                  <Text style={styles.podiumHeaderTitle}>🎖️ PÓDIO DOS DESTAQUES</Text>
                  <Text style={styles.podiumHeaderHint}>Toque para ver perfil</Text>
                </View>

                <View style={styles.podiumContainer}>
                  {/* 2nd Place (Left - Silver) */}
                  <TouchableOpacity
                    style={[
                      styles.podiumColumn,
                      styles.podiumSecond,
                      top2?.uid === currentUserId && styles.podiumSelf,
                    ]}
                    onPress={() => top2 && handleOpenProfile(top2)}
                    activeOpacity={top2 ? 0.8 : 1}
                    disabled={!top2}
                  >
                    <View style={[styles.podiumMedalBadge, styles.podiumMedalSilver]}>
                      <Text style={styles.podiumMedalText}>🥈 2º</Text>
                    </View>

                    <UserAvatar
                      avatar={top2?.avatar}
                      badge={top2?.equippedBadge}
                      name={top2?.name}
                      size={52}
                      borderColor="#94a3b8"
                      borderWidth={2}
                      backgroundColor="#1e293b"
                    />

                    <Text style={styles.podiumName} numberOfLines={1}>
                      {top2 ? (top2.nickname?.trim() || top2.name) : "Vago"}
                    </Text>

                    {top2?.equippedTitle ? (
                      <Text style={styles.podiumTitleSilver} numberOfLines={1}>
                        {top2.equippedTitle}
                      </Text>
                    ) : null}

                    {top2 && (
                      <View style={styles.podiumPointsPill}>
                        <Text style={styles.podiumPointsText}>{formatPoopcoins(getPoints(top2))}</Text>
                        <Text style={styles.podiumPointsUnit}>pts</Text>
                      </View>
                    )}

                    {/* Streaks on Podium */}
                    {top2 && (
                      <View style={styles.podiumStreakRow}>
                        {(top2.currentDailyStreak || 0) > 0 && (
                          <View style={styles.podiumStreakBadge}>
                            <Text style={styles.podiumStreakText}>🔥 {top2.currentDailyStreak}d</Text>
                          </View>
                        )}
                        {(top2.currentWeeklyStreak || 0) > 0 && (
                          <View style={styles.podiumWeeklyBadge}>
                            <Text style={styles.podiumWeeklyText}>⚡ {top2.currentWeeklyStreak}s</Text>
                          </View>
                        )}
                      </View>
                    )}

                    {top2?.uid === currentUserId && (
                      <View style={styles.selfPodiumChip}>
                        <Text style={styles.selfPodiumChipText}>VOCÊ</Text>
                      </View>
                    )}

                    <View style={[styles.podiumPillar, styles.pillarSilver]} />
                  </TouchableOpacity>

                  {/* 1st Place (Center - Elevated Gold Champion) */}
                  <TouchableOpacity
                    style={[
                      styles.podiumColumn,
                      styles.podiumFirst,
                      top1?.uid === currentUserId && styles.podiumSelf,
                    ]}
                    onPress={() => top1 && handleOpenProfile(top1)}
                    activeOpacity={top1 ? 0.8 : 1}
                    disabled={!top1}
                  >
                    <Text style={styles.podiumCrown}>👑</Text>

                    <View style={[styles.podiumMedalBadge, styles.podiumMedalGold]}>
                      <Text style={styles.podiumMedalTextGold}>🥇 1º LUGAR</Text>
                    </View>

                    <View style={styles.goldAvatarGlow}>
                      <UserAvatar
                        avatar={top1?.avatar}
                        badge={top1?.equippedBadge}
                        name={top1?.name}
                        size={64}
                        borderColor="#eab308"
                        borderWidth={3}
                        backgroundColor="rgba(234, 179, 8, 0.15)"
                        textColor="#facc15"
                      />
                    </View>

                    <Text style={[styles.podiumName, styles.podiumNameGold]} numberOfLines={1}>
                      {top1 ? (top1.nickname?.trim() || top1.name) : "Vago"}
                    </Text>

                    {top1?.equippedTitle ? (
                      <Text style={styles.podiumTitleGold} numberOfLines={1}>
                        👑 {top1.equippedTitle}
                      </Text>
                    ) : null}

                    {top1 && (
                      <View style={[styles.podiumPointsPill, styles.podiumPointsPillGold]}>
                        <Text style={[styles.podiumPointsText, styles.podiumPointsTextGold]}>
                          {formatPoopcoins(getPoints(top1))}
                        </Text>
                        <Text style={styles.podiumPointsUnitGold}>pts</Text>
                      </View>
                    )}

                    {/* Streaks on Podium */}
                    {top1 && (
                      <View style={styles.podiumStreakRow}>
                        {(top1.currentDailyStreak || 0) > 0 && (
                          <View style={[styles.podiumStreakBadge, styles.podiumStreakBadgeGold]}>
                            <Text style={styles.podiumStreakText}>🔥 {top1.currentDailyStreak}d</Text>
                          </View>
                        )}
                        {(top1.currentWeeklyStreak || 0) > 0 && (
                          <View style={styles.podiumWeeklyBadge}>
                            <Text style={styles.podiumWeeklyText}>⚡ {top1.currentWeeklyStreak}s</Text>
                          </View>
                        )}
                      </View>
                    )}

                    {top1?.uid === currentUserId && (
                      <View style={styles.selfPodiumChip}>
                        <Text style={styles.selfPodiumChipText}>VOCÊ</Text>
                      </View>
                    )}

                    <View style={[styles.podiumPillar, styles.pillarGold]} />
                  </TouchableOpacity>

                  {/* 3rd Place (Right - Bronze) */}
                  <TouchableOpacity
                    style={[
                      styles.podiumColumn,
                      styles.podiumThird,
                      top3?.uid === currentUserId && styles.podiumSelf,
                    ]}
                    onPress={() => top3 && handleOpenProfile(top3)}
                    activeOpacity={top3 ? 0.8 : 1}
                    disabled={!top3}
                  >
                    <View style={[styles.podiumMedalBadge, styles.podiumMedalBronze]}>
                      <Text style={styles.podiumMedalText}>🥉 3º</Text>
                    </View>

                    <UserAvatar
                      avatar={top3?.avatar}
                      badge={top3?.equippedBadge}
                      name={top3?.name}
                      size={48}
                      borderColor="#cd7f32"
                      borderWidth={2}
                      backgroundColor="#1e293b"
                    />

                    <Text style={styles.podiumName} numberOfLines={1}>
                      {top3 ? (top3.nickname?.trim() || top3.name) : "Vago"}
                    </Text>

                    {top3?.equippedTitle ? (
                      <Text style={styles.podiumTitleBronze} numberOfLines={1}>
                        {top3.equippedTitle}
                      </Text>
                    ) : null}

                    {top3 && (
                      <View style={styles.podiumPointsPill}>
                        <Text style={styles.podiumPointsText}>{formatPoopcoins(getPoints(top3))}</Text>
                        <Text style={styles.podiumPointsUnit}>pts</Text>
                      </View>
                    )}

                    {/* Streaks on Podium */}
                    {top3 && (
                      <View style={styles.podiumStreakRow}>
                        {(top3.currentDailyStreak || 0) > 0 && (
                          <View style={styles.podiumStreakBadge}>
                            <Text style={styles.podiumStreakText}>🔥 {top3.currentDailyStreak}d</Text>
                          </View>
                        )}
                        {(top3.currentWeeklyStreak || 0) > 0 && (
                          <View style={styles.podiumWeeklyBadge}>
                            <Text style={styles.podiumWeeklyText}>⚡ {top3.currentWeeklyStreak}s</Text>
                          </View>
                        )}
                      </View>
                    )}

                    {top3?.uid === currentUserId && (
                      <View style={styles.selfPodiumChip}>
                        <Text style={styles.selfPodiumChipText}>VOCÊ</Text>
                      </View>
                    )}

                    <View style={[styles.podiumPillar, styles.pillarBronze]} />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Current User Fixed Status Banner */}
            {currentUserData && (
              <TouchableOpacity
                style={styles.currentUserCard}
                onPress={() => handleOpenProfile(currentUserData)}
                activeOpacity={0.8}
              >
                <View style={styles.currentUserLeft}>
                  <View style={styles.currentUserPosBadge}>
                    <Text style={styles.currentUserPosText}>#{currentUserIndex + 1}</Text>
                  </View>
                  <View style={styles.currentUserInfo}>
                    <View style={styles.currentUserHeaderRow}>
                      <Text style={styles.currentUserLabel}>Sua Colocação Atual</Text>
                      <View style={styles.youPill}>
                        <Text style={styles.youPillText}>VOCÊ</Text>
                      </View>
                    </View>
                    <View style={styles.currentUserMetaRow}>
                      <Text style={styles.currentUserStreakText}>
                        🔥 {currentUserData.currentDailyStreak || 0} dias
                      </Text>
                      {(currentUserData.currentWeeklyStreak || 0) > 0 && (
                        <Text style={styles.currentUserWeeklyStreakText}>
                          • ⚡ {currentUserData.currentWeeklyStreak} sem
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
                <View style={styles.currentUserScore}>
                  <Text style={styles.currentUserScoreValue}>
                    {formatPoopcoins(getPoints(currentUserData))}
                  </Text>
                  <Text style={styles.currentUserScoreUnit}>pts</Text>
                </View>
              </TouchableOpacity>
            )}

            {/* Section Header for List */}
            {runnersUp.length > 0 && (
              <View style={styles.listHeaderRow}>
                <Text style={styles.sectionHeaderTitle}>
                  {isFiltering ? `RESULTADOS DA BUSCA (${runnersUp.length})` : "DEMAIS COMPETIDORES"}
                </Text>
                <Text style={styles.listTapHint}>Toque para ver perfil</Text>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          leaders.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>🚽</Text>
              <Text style={styles.emptyText}>Nenhum competidor registrado ainda.</Text>
            </View>
          ) : isFiltering ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>🔍</Text>
              <Text style={styles.emptyText}>Nenhum colega encontrado com "{searchQuery}".</Text>
            </View>
          ) : null
        }
        renderItem={({ item, index }) => {
          // If filtering, rank is index in leaders list + 1; otherwise index + 4
          const originalIndex = leaders.findIndex((u) => u.uid === item.uid);
          const rank = originalIndex >= 0 ? originalIndex + 1 : index + 4;
          const isCurrentUser = currentUserId && item.uid === currentUserId;
          const dailyStreak = item.currentDailyStreak || 0;
          const weeklyStreak = item.currentWeeklyStreak || 0;
          const points = getPoints(item);

          // Super streak check
          const isSuperStreak = dailyStreak >= 7;

          return (
            <TouchableOpacity
              style={[styles.leaderCard, isCurrentUser && styles.leaderCardSelf]}
              onPress={() => handleOpenProfile(item)}
              activeOpacity={0.7}
            >
              <View style={styles.positionBadge}>
                <Text style={[styles.positionText, isCurrentUser && styles.positionTextSelf]}>
                  #{rank}
                </Text>
              </View>

              <View style={styles.avatarWrap}>
                <UserAvatar
                  avatar={item.avatar}
                  badge={item.equippedBadge}
                  name={item.name}
                  size={42}
                  borderColor={isCurrentUser ? "#38bdf8" : "#334155"}
                  borderWidth={1.5}
                />
              </View>

              <View style={styles.userInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.userName} numberOfLines={1}>
                    {item.nickname?.trim() || item.name || "Cagador Anônimo"}
                  </Text>
                  {isCurrentUser && (
                    <View style={styles.selfBadge}>
                      <Text style={styles.selfBadgeText}>VOCÊ</Text>
                    </View>
                  )}
                </View>

                {item.equippedTitle ? (
                  <Text style={styles.userTitle} numberOfLines={1}>
                    👑 {item.equippedTitle}
                  </Text>
                ) : null}

                {/* Streaks & Flames (🔥) */}
                <View style={styles.streakRow}>
                  {dailyStreak > 0 ? (
                    <View style={[styles.flamePill, isSuperStreak && styles.flamePillSuper]}>
                      <Text style={[styles.flamePillText, isSuperStreak && styles.flamePillTextSuper]}>
                        🔥 {dailyStreak}d{isSuperStreak ? " MEGA" : ""}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.neutralStreakPill}>
                      <Text style={styles.neutralStreakText}>🔥 0d</Text>
                    </View>
                  )}

                  {weeklyStreak > 0 && (
                    <View style={styles.zapPill}>
                      <Text style={styles.zapPillText}>⚡ {weeklyStreak}sem</Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.scoreContainer}>
                <Text style={styles.scorePoints}>{formatPoopcoins(points)}</Text>
                <Text style={styles.scoreLabel}>pts</Text>
                <Text style={styles.cardArrow}>›</Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* Colleague Public Profile Modal */}
      <UserProfileModal
        visible={profileModalVisible}
        userId={selectedUserId}
        currentUserId={currentUserId || ""}
        onClose={() => setProfileModalVisible(false)}
        onOpenTransfer={handleOpenTransfer}
      />

      {/* Tip / Transfer Poopcoins Modal */}
      {currentUser && (
        <TransferPoopcoinsModal
          visible={transferModalVisible}
          currentUser={currentUser}
          initialRecipientUser={tipRecipientUser}
          onClose={() => setTransferModalVisible(false)}
          onSuccess={() => {
            onRefreshUser?.();
            fetchLeaders(mode);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#020617",
  },
  centerContainer: {
    flex: 1,
    backgroundColor: "#020617",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: {
    color: "#94a3b8",
    fontSize: 14,
    marginTop: 12,
    fontWeight: "600",
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
    backgroundColor: "#020617",
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 23,
    fontWeight: "900",
    color: "#f8fafc",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 2,
  },
  shareHeaderBtn: {
    backgroundColor: "rgba(234, 179, 8, 0.15)",
    borderWidth: 1,
    borderColor: "#eab308",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  shareHeaderBtnText: {
    color: "#facc15",
    fontSize: 11,
    fontWeight: "800",
  },
  headerBadge: {
    backgroundColor: "rgba(234, 179, 8, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.3)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  headerBadgeText: {
    color: "#eab308",
    fontSize: 11,
    fontWeight: "800",
  },
  leagueBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(234, 179, 8, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.25)",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 10,
  },
  leagueBannerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  leagueBannerIcon: {
    fontSize: 18,
  },
  leagueBannerTextCol: {
    flex: 1,
  },
  leagueBannerTitle: {
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "800",
  },
  leagueBannerDesc: {
    color: "#94a3b8",
    fontSize: 10,
    marginTop: 1,
  },
  leagueBannerArrow: {
    color: "#eab308",
    fontSize: 13,
    fontWeight: "900",
    marginLeft: 6,
  },
  tabSwitcher: {
    flexDirection: "row",
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 3,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  tabSwitcherSingle: {
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 3,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  tabButtonSingle: {
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    flexDirection: "row",
    gap: 6,
    backgroundColor: "rgba(234, 179, 8, 0.15)",
    borderWidth: 1,
    borderColor: "#eab308",
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    flexDirection: "row",
    gap: 6,
  },
  tabButtonActive: {
    backgroundColor: "#eab308",
    shadowColor: "#eab308",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  tabButtonText: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
  },
  tabButtonTextActive: {
    color: "#020617",
    fontWeight: "900",
  },
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#020617",
  },
  countdownRibbon: {
    marginTop: 6,
    alignItems: "center",
  },
  countdownText: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
  },
  metricsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: "rgba(15, 23, 42, 0.7)",
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  metricItem: {
    alignItems: "center",
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#64748b",
    letterSpacing: 0.5,
  },
  metricValue: {
    fontSize: 12,
    fontWeight: "800",
    color: "#f8fafc",
    marginTop: 1,
  },
  metricValueGold: {
    fontSize: 12,
    fontWeight: "900",
    color: "#eab308",
    marginTop: 1,
  },
  metricValueOrange: {
    fontSize: 12,
    fontWeight: "900",
    color: "#f97316",
    marginTop: 1,
  },
  metricDivider: {
    width: 1,
    height: 18,
    backgroundColor: "#1e293b",
  },
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0f172a",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1e293b",
    paddingHorizontal: 10,
    marginTop: 8,
    height: 36,
  },
  searchIcon: {
    fontSize: 13,
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    color: "#f8fafc",
    fontSize: 12,
    paddingVertical: 4,
  },
  clearSearchBtn: {
    padding: 4,
  },
  clearSearchText: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "bold",
  },
  listContent: {
    padding: 14,
    paddingBottom: 36,
  },
  sectionHeaderTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#94a3b8",
    letterSpacing: 0.8,
  },
  listHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  listTapHint: {
    fontSize: 10,
    color: "#64748b",
    fontWeight: "600",
  },

  /* PODIUM STYLES */
  podiumSection: {
    marginTop: 4,
    marginBottom: 14,
  },
  podiumHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  podiumHeaderTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#94a3b8",
    letterSpacing: 0.8,
  },
  podiumHeaderHint: {
    fontSize: 10,
    color: "#64748b",
    fontWeight: "600",
  },
  podiumContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 8,
    paddingTop: 12,
  },
  podiumColumn: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#0f172a",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1e293b",
    paddingTop: 12,
    paddingHorizontal: 4,
    position: "relative",
  },
  podiumSelf: {
    borderColor: "#38bdf8",
    backgroundColor: "rgba(56, 189, 248, 0.08)",
  },
  podiumFirst: {
    borderColor: "#eab308",
    backgroundColor: "rgba(234, 179, 8, 0.07)",
    paddingTop: 16,
    zIndex: 2,
  },
  podiumSecond: {
    borderColor: "#64748b",
    backgroundColor: "rgba(148, 163, 184, 0.05)",
  },
  podiumThird: {
    borderColor: "#b45309",
    backgroundColor: "rgba(180, 83, 9, 0.05)",
  },
  podiumCrown: {
    fontSize: 22,
    position: "absolute",
    top: -12,
  },
  podiumMedalBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 6,
  },
  podiumMedalGold: {
    backgroundColor: "#eab308",
  },
  podiumMedalSilver: {
    backgroundColor: "#64748b",
  },
  podiumMedalBronze: {
    backgroundColor: "#b45309",
  },
  podiumMedalText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#020617",
  },
  podiumMedalTextGold: {
    fontSize: 10,
    fontWeight: "900",
    color: "#020617",
  },
  goldAvatarGlow: {
    shadowColor: "#eab308",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 4,
  },
  podiumName: {
    fontSize: 12,
    fontWeight: "800",
    color: "#f8fafc",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 2,
  },
  podiumNameGold: {
    fontSize: 13,
    color: "#facc15",
    fontWeight: "900",
  },
  podiumTitleGold: {
    fontSize: 9,
    color: "#facc15",
    fontWeight: "700",
    marginBottom: 2,
  },
  podiumTitleSilver: {
    fontSize: 9,
    color: "#94a3b8",
    fontWeight: "600",
    marginBottom: 2,
  },
  podiumTitleBronze: {
    fontSize: 9,
    color: "#cd7f32",
    fontWeight: "600",
    marginBottom: 2,
  },
  podiumPointsPill: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 2,
    backgroundColor: "#1e293b",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginBottom: 4,
    marginTop: 2,
  },
  podiumPointsPillGold: {
    backgroundColor: "rgba(234, 179, 8, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.4)",
  },
  podiumPointsText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#f8fafc",
  },
  podiumPointsTextGold: {
    color: "#facc15",
  },
  podiumPointsUnit: {
    fontSize: 8,
    color: "#94a3b8",
    fontWeight: "600",
  },
  podiumPointsUnitGold: {
    fontSize: 8,
    color: "#eab308",
    fontWeight: "700",
  },
  podiumStreakRow: {
    flexDirection: "row",
    gap: 3,
    marginBottom: 4,
  },
  podiumStreakBadge: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  podiumStreakBadgeGold: {
    backgroundColor: "rgba(245, 158, 11, 0.25)",
  },
  podiumStreakText: {
    fontSize: 9,
    color: "#f59e0b",
    fontWeight: "800",
  },
  podiumWeeklyBadge: {
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  podiumWeeklyText: {
    fontSize: 9,
    color: "#38bdf8",
    fontWeight: "800",
  },
  selfPodiumChip: {
    backgroundColor: "#0284c7",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginBottom: 4,
  },
  selfPodiumChipText: {
    color: "#ffffff",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  podiumPillar: {
    width: "100%",
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
  },
  pillarGold: {
    height: 18,
    backgroundColor: "#eab308",
  },
  pillarSilver: {
    height: 12,
    backgroundColor: "#64748b",
  },
  pillarBronze: {
    height: 8,
    backgroundColor: "#b45309",
  },

  /* CURRENT USER HIGHLIGHT CARD */
  currentUserCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(56, 189, 248, 0.09)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.4)",
    borderRadius: 14,
    padding: 10,
    marginBottom: 6,
  },
  currentUserLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  currentUserPosBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#0284c7",
    alignItems: "center",
    justifyContent: "center",
  },
  currentUserPosText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
  },
  currentUserInfo: {},
  currentUserHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  currentUserLabel: {
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "800",
  },
  youPill: {
    backgroundColor: "#0284c7",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  youPillText: {
    color: "#ffffff",
    fontSize: 7,
    fontWeight: "900",
  },
  currentUserMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  currentUserStreakText: {
    color: "#f59e0b",
    fontSize: 11,
    fontWeight: "700",
  },
  currentUserWeeklyStreakText: {
    color: "#38bdf8",
    fontSize: 11,
    fontWeight: "700",
  },
  currentUserScore: {
    alignItems: "flex-end",
  },
  currentUserScoreValue: {
    fontSize: 17,
    fontWeight: "900",
    color: "#38bdf8",
  },
  currentUserScoreUnit: {
    fontSize: 9,
    color: "#94a3b8",
    fontWeight: "700",
  },

  /* RUNNERS-UP LIST STYLES */
  leaderCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 14,
    padding: 10,
    marginBottom: 7,
  },
  leaderCardSelf: {
    borderColor: "#38bdf8",
    backgroundColor: "rgba(56, 189, 248, 0.06)",
  },
  positionBadge: {
    width: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  positionText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#64748b",
  },
  positionTextSelf: {
    color: "#38bdf8",
    fontWeight: "900",
  },
  avatarWrap: {
    marginRight: 8,
    marginLeft: 2,
  },
  userInfo: {
    flex: 1,
    marginRight: 6,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  userName: {
    fontSize: 13,
    fontWeight: "800",
    color: "#f8fafc",
    flexShrink: 1,
  },
  userTitle: {
    fontSize: 10,
    color: "#facc15",
    fontWeight: "700",
    marginTop: 1,
  },
  selfBadge: {
    backgroundColor: "#0284c7",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  selfBadgeText: {
    color: "#ffffff",
    fontSize: 7,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  streakRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 3,
  },
  flamePill: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 5,
  },
  flamePillSuper: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.4)",
  },
  flamePillText: {
    fontSize: 10,
    color: "#f59e0b",
    fontWeight: "700",
  },
  flamePillTextSuper: {
    color: "#ef4444",
    fontWeight: "900",
  },
  neutralStreakPill: {
    backgroundColor: "#1e293b",
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 5,
  },
  neutralStreakText: {
    fontSize: 9,
    color: "#64748b",
    fontWeight: "600",
  },
  zapPill: {
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 5,
  },
  zapPillText: {
    fontSize: 9,
    color: "#38bdf8",
    fontWeight: "700",
  },
  scoreContainer: {
    alignItems: "flex-end",
    justifyContent: "center",
    minWidth: 55,
  },
  scorePoints: {
    fontSize: 15,
    fontWeight: "900",
    color: "#eab308",
  },
  scoreLabel: {
    fontSize: 8,
    color: "#94a3b8",
    fontWeight: "600",
  },
  cardArrow: {
    color: "#475569",
    fontSize: 15,
    fontWeight: "900",
    marginTop: -2,
  },

  /* EMPTY & ERROR STATES */
  emptyContainer: {
    alignItems: "center",
    marginTop: 36,
    padding: 20,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 10,
  },
  emptyText: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  errorEmoji: {
    fontSize: 38,
    marginBottom: 8,
  },
  errorTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#f8fafc",
    marginBottom: 4,
  },
  errorSubtitle: {
    fontSize: 12,
    color: "#94a3b8",
    textAlign: "center",
    marginBottom: 14,
    paddingHorizontal: 20,
  },
  retryButton: {
    backgroundColor: "#eab308",
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 10,
  },
  retryButtonText: {
    color: "#020617",
    fontWeight: "800",
    fontSize: 12,
  },
});
