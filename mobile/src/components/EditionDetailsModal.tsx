import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from "react-native";
import { EditionRecord, EditionCompetitor } from "../types";

interface EditionDetailsModalProps {
  visible: boolean;
  editionRecord: EditionRecord | null;
  onClose: () => void;
  currentUserUid?: string;
}

export function EditionDetailsModal({
  visible,
  editionRecord,
  onClose,
  currentUserUid,
}: EditionDetailsModalProps) {
  const [searchQuery, setSearchQuery] = useState("");

  if (!editionRecord) return null;

  const competitors = editionRecord.competitors || [];
  const winners = editionRecord.winners || [];
  const isHistorical = !!editionRecord.isHistoricalFallback || competitors.length === 0;

  // Filtro de competidores
  const filteredCompetitors = competitors.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.nickname && c.nickname.toLowerCase().includes(q))
    );
  });

  // Top 3 do pódio
  const top1 = competitors.find((c) => c.rank === 1);
  const top2 = competitors.find((c) => c.rank === 2);
  const top3 = competitors.find((c) => c.rank === 3);

  // Formatação amigável da data
  const formatDate = (val: any) => {
    if (!val) return "Arquivo Histórico";
    try {
      const date =
        typeof val.toDate === "function"
          ? val.toDate()
          : typeof val.toMillis === "function"
          ? new Date(val.toMillis())
          : new Date(val);
      if (isNaN(date.getTime())) return "Arquivo Histórico";
      return date.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Arquivo Histórico";
    }
  };

  const formattedDate = formatDate(editionRecord.endedAt || editionRecord.createdAt);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header com Troféu Dourado */}
          <View style={styles.header}>
            <View style={styles.trophyIconContainer}>
              <Text style={styles.trophyIcon}>🏆</Text>
            </View>
            <View style={styles.headerInfo}>
              <View style={styles.titleRow}>
                <Text style={styles.title}>
                  {editionRecord.title || `Edição ${editionRecord.romanEdition || editionRecord.edition}`}
                </Text>
                <View style={styles.editionPill}>
                  <Text style={styles.editionPillText}>#{editionRecord.edition}</Text>
                </View>
              </View>
              <Text style={styles.subtitle}>
                Hall da Fama • Campeões do Trono
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
          >
            {/* Banner de Vencedor(es) */}
            <View style={styles.winnerCard}>
              <View style={styles.winnerCardHeader}>
                <Text style={styles.winnerCrownIcon}>👑</Text>
                <Text style={styles.winnerCardLabel}>
                  {winners.length > 1 ? "GRANDES CAMPEÕES" : "GRANDE CAMPEÃO DO TRONO"}
                </Text>
              </View>

              {winners.length > 0 ? (
                <View style={styles.winnersList}>
                  {winners.map((w, idx) => (
                    <View key={w.uid || idx} style={styles.winnerRow}>
                      <View style={styles.winnerAvatarBox}>
                        <Text style={styles.winnerAvatarEmoji}>{w.avatar || "🚿"}</Text>
                      </View>
                      <View style={styles.winnerInfo}>
                        <Text style={styles.winnerName} numberOfLines={1}>
                          {w.nickname || w.name}
                        </Text>
                        <Text style={styles.winnerPoints}>
                          {w.points.toLocaleString("pt-BR")} pontos conquistados
                        </Text>
                      </View>
                      {currentUserUid === w.uid && (
                        <View style={styles.youBadge}>
                          <Text style={styles.youBadgeText}>VOCÊ 👑</Text>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.winnerEmptyBox}>
                  <Text style={styles.winnerEmptyName}>
                    {editionRecord.winnerNames?.join(", ") || "Campeão Consagrado"}
                  </Text>
                  <Text style={styles.winnerEmptySub}>
                    Título oficial registrado na história do Trono
                  </Text>
                </View>
              )}
            </View>

            {/* Grid de Estatísticas da Edição */}
            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>COMPETIDORES</Text>
                <Text style={styles.statValue}>
                  {editionRecord.totalCompetitors || competitors.length || "—"}
                </Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>MAIOR PONTUAÇÃO</Text>
                <Text style={[styles.statValue, { color: "#facc15" }]}>
                  {editionRecord.maxPoints > 0
                    ? `${editionRecord.maxPoints.toLocaleString("pt-BR")} pts`
                    : "—"}
                </Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>TOTAL DA RODADA</Text>
                <Text style={styles.statValue}>
                  {editionRecord.totalPoints > 0
                    ? `${editionRecord.totalPoints.toLocaleString("pt-BR")} pts`
                    : "—"}
                </Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>FINALIZADA EM</Text>
                <Text style={styles.statValueSmall}>{formattedDate}</Text>
              </View>
            </View>

            {/* Pódio visual (Top 3) se existirem competidores */}
            {!isHistorical && top1 && (
              <View style={styles.podiumSection}>
                <Text style={styles.sectionHeaderTitle}>🎖️ PÓDIO DA EDIÇÃO</Text>
                <View style={styles.podiumContainer}>
                  {/* 2º Lugar */}
                  <View style={[styles.podiumColumn, styles.podiumCol2]}>
                    <Text style={styles.podiumMedal}>🥈</Text>
                    <View style={styles.podiumAvatarBox}>
                      <Text style={styles.podiumAvatarText}>{top2?.avatar || "🚿"}</Text>
                    </View>
                    <Text style={styles.podiumName} numberOfLines={1}>
                      {top2 ? top2.nickname || top2.name : "—"}
                    </Text>
                    <Text style={styles.podiumPoints}>
                      {top2 ? `${top2.points.toLocaleString("pt-BR")} pts` : "—"}
                    </Text>
                    <View style={[styles.podiumBar, styles.podiumBar2]}>
                      <Text style={styles.podiumRankText}>2º</Text>
                    </View>
                  </View>

                  {/* 1º Lugar */}
                  <View style={[styles.podiumColumn, styles.podiumCol1]}>
                    <Text style={styles.podiumCrown}>👑</Text>
                    <View style={[styles.podiumAvatarBox, styles.podiumAvatarBox1]}>
                      <Text style={styles.podiumAvatarText}>{top1.avatar || "🚿"}</Text>
                    </View>
                    <Text style={[styles.podiumName, styles.podiumName1]} numberOfLines={1}>
                      {top1.nickname || top1.name}
                    </Text>
                    <Text style={[styles.podiumPoints, styles.podiumPoints1]}>
                      {top1.points.toLocaleString("pt-BR")} pts
                    </Text>
                    <View style={[styles.podiumBar, styles.podiumBar1]}>
                      <Text style={styles.podiumRankText1}>1º</Text>
                    </View>
                  </View>

                  {/* 3º Lugar */}
                  <View style={[styles.podiumColumn, styles.podiumCol3]}>
                    <Text style={styles.podiumMedal}>🥉</Text>
                    <View style={styles.podiumAvatarBox}>
                      <Text style={styles.podiumAvatarText}>{top3?.avatar || "🚿"}</Text>
                    </View>
                    <Text style={styles.podiumName} numberOfLines={1}>
                      {top3 ? top3.nickname || top3.name : "—"}
                    </Text>
                    <Text style={styles.podiumPoints}>
                      {top3 ? `${top3.points.toLocaleString("pt-BR")} pts` : "—"}
                    </Text>
                    <View style={[styles.podiumBar, styles.podiumBar3]}>
                      <Text style={styles.podiumRankText}>3º</Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* Mensagem Histórica se não houver dados de competidores individuais */}
            {isHistorical && (
              <View style={styles.historicalNoteCard}>
                <Text style={styles.historicalNoteIcon}>📜</Text>
                <View style={styles.historicalNoteContent}>
                  <Text style={styles.historicalNoteTitle}>Arquivo Histórico Consagrado</Text>
                  <Text style={styles.historicalNoteText}>
                    Esta edição foi vencida e consolidada antes da implementação do registro detalhado de competidores. O troféu e o título permanecem imortalizados com orgulho no perfil do campeão!
                  </Text>
                </View>
              </View>
            )}

            {/* Tabela Completa de Competidores */}
            {competitors.length > 0 && (
              <View style={styles.competitorsSection}>
                <View style={styles.competitorsHeaderRow}>
                  <Text style={styles.sectionHeaderTitle}>
                    👥 TABELA DE COMPETIDORES ({competitors.length})
                  </Text>
                </View>

                {competitors.length > 8 && (
                  <View style={styles.searchBar}>
                    <Text style={styles.searchIcon}>🔍</Text>
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Buscar competidor nesta edição..."
                      placeholderTextColor="#64748b"
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                      <TouchableOpacity onPress={() => setSearchQuery("")}>
                        <Text style={styles.searchClear}>✕</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                <View style={styles.competitorsList}>
                  {filteredCompetitors.map((comp) => {
                    const isSelf = currentUserUid === comp.uid;
                    const isWin = comp.isWinner;

                    return (
                      <View
                        key={comp.uid}
                        style={[
                          styles.competitorRow,
                          isWin && styles.competitorRowWinner,
                          isSelf && styles.competitorRowSelf,
                        ]}
                      >
                        {/* Posição / Medalha */}
                        <View style={styles.rankBox}>
                          {comp.rank === 1 ? (
                            <Text style={styles.medalText}>🥇</Text>
                          ) : comp.rank === 2 ? (
                            <Text style={styles.medalText}>🥈</Text>
                          ) : comp.rank === 3 ? (
                            <Text style={styles.medalText}>🥉</Text>
                          ) : (
                            <Text style={styles.rankNumberText}>{comp.rank}º</Text>
                          )}
                        </View>

                        {/* Avatar */}
                        <View
                          style={[
                            styles.competitorAvatar,
                            { borderColor: comp.themeColor || "#334155" },
                          ]}
                        >
                          <Text style={styles.competitorAvatarEmoji}>
                            {comp.avatar || "🚿"}
                          </Text>
                        </View>

                        {/* Nome & Nickname */}
                        <View style={styles.competitorInfo}>
                          <View style={styles.competitorNameRow}>
                            <Text
                              style={[
                                styles.competitorName,
                                isWin && { color: "#facc15", fontWeight: "900" },
                                isSelf && { color: "#38bdf8" },
                              ]}
                              numberOfLines={1}
                            >
                              {comp.nickname || comp.name}
                            </Text>
                            {isSelf && (
                              <View style={styles.selfTag}>
                                <Text style={styles.selfTagText}>Você</Text>
                              </View>
                            )}
                            {isWin && (
                              <View style={styles.winnerBadgeMini}>
                                <Text style={styles.winnerBadgeMiniText}>🏆 Campeão</Text>
                              </View>
                            )}
                          </View>
                          {comp.nickname && comp.nickname !== comp.name && (
                            <Text style={styles.competitorRealName} numberOfLines={1}>
                              {comp.name}
                            </Text>
                          )}
                        </View>

                        {/* Pontos */}
                        <View style={styles.competitorPointsBox}>
                          <Text
                            style={[
                              styles.competitorPointsText,
                              isWin && { color: "#facc15" },
                            ]}
                          >
                            {comp.points.toLocaleString("pt-BR")}
                          </Text>
                          <Text style={styles.competitorPointsLabel}>pts</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}
          </ScrollView>

          {/* Footer com Botão Fechar */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.doneBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.doneBtnText}>Fechar Detalhes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 23, 0.85)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: "#0b1329",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "92%",
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.35)",
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
    backgroundColor: "#0f172a",
  },
  trophyIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(234, 179, 8, 0.18)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#eab308",
    marginRight: 14,
  },
  trophyIcon: {
    fontSize: 26,
  },
  headerInfo: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: "900",
  },
  editionPill: {
    backgroundColor: "rgba(234, 179, 8, 0.25)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#eab308",
  },
  editionPillText: {
    color: "#facc15",
    fontSize: 11,
    fontWeight: "800",
  },
  subtitle: {
    color: "#94a3b8",
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#1e293b",
    justifyContent: "center",
    alignItems: "center",
  },
  closeBtnText: {
    color: "#cbd5e1",
    fontSize: 14,
    fontWeight: "bold",
  },
  content: {
    flexGrow: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 30,
  },
  winnerCard: {
    backgroundColor: "rgba(234, 179, 8, 0.12)",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: "rgba(234, 179, 8, 0.45)",
    marginBottom: 16,
  },
  winnerCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  winnerCrownIcon: {
    fontSize: 18,
  },
  winnerCardLabel: {
    color: "#fde047",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  winnersList: {
    gap: 10,
  },
  winnerRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.3)",
  },
  winnerAvatarBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#1e293b",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    borderWidth: 2,
    borderColor: "#eab308",
  },
  winnerAvatarEmoji: {
    fontSize: 22,
  },
  winnerInfo: {
    flex: 1,
  },
  winnerName: {
    color: "#f8fafc",
    fontSize: 15,
    fontWeight: "900",
  },
  winnerPoints: {
    color: "#facc15",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  youBadge: {
    backgroundColor: "#eab308",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  youBadgeText: {
    color: "#0f172a",
    fontSize: 10,
    fontWeight: "900",
  },
  winnerEmptyBox: {
    paddingVertical: 6,
  },
  winnerEmptyName: {
    color: "#fef08a",
    fontSize: 16,
    fontWeight: "800",
  },
  winnerEmptySub: {
    color: "#cbd5e1",
    fontSize: 12,
    marginTop: 2,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
  },
  statBox: {
    flex: 1,
    minWidth: "47%",
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  statLabel: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statValue: {
    color: "#f8fafc",
    fontSize: 15,
    fontWeight: "900",
  },
  statValueSmall: {
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: "700",
  },
  podiumSection: {
    marginBottom: 22,
  },
  sectionHeaderTitle: {
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  podiumContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    backgroundColor: "#0f172a",
    borderRadius: 16,
    padding: 16,
    paddingTop: 24,
    borderWidth: 1,
    borderColor: "#1e293b",
    gap: 8,
  },
  podiumColumn: {
    flex: 1,
    alignItems: "center",
  },
  podiumCol1: {
    flex: 1.2,
  },
  podiumCol2: {},
  podiumCol3: {},
  podiumCrown: {
    fontSize: 22,
    marginBottom: 2,
  },
  podiumMedal: {
    fontSize: 18,
    marginBottom: 4,
  },
  podiumAvatarBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1e293b",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#64748b",
    marginBottom: 6,
  },
  podiumAvatarBox1: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderColor: "#eab308",
    borderWidth: 2,
  },
  podiumAvatarText: {
    fontSize: 20,
  },
  podiumName: {
    color: "#cbd5e1",
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 2,
  },
  podiumName1: {
    color: "#fef08a",
    fontSize: 12,
    fontWeight: "900",
  },
  podiumPoints: {
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 8,
  },
  podiumPoints1: {
    color: "#facc15",
    fontWeight: "800",
  },
  podiumBar: {
    width: "100%",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 10,
  },
  podiumBar1: {
    backgroundColor: "rgba(234, 179, 8, 0.35)",
    borderWidth: 1.5,
    borderColor: "#eab308",
    height: 60,
  },
  podiumBar2: {
    backgroundColor: "rgba(148, 163, 184, 0.2)",
    borderWidth: 1,
    borderColor: "#94a3b8",
    height: 44,
  },
  podiumBar3: {
    backgroundColor: "rgba(202, 138, 4, 0.2)",
    borderWidth: 1,
    borderColor: "#ca8a04",
    height: 34,
  },
  podiumRankText: {
    color: "#e2e8f0",
    fontSize: 13,
    fontWeight: "900",
  },
  podiumRankText1: {
    color: "#facc15",
    fontSize: 15,
    fontWeight: "900",
  },
  historicalNoteCard: {
    flexDirection: "row",
    backgroundColor: "rgba(30, 41, 59, 0.6)",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#334155",
    gap: 12,
    marginBottom: 16,
  },
  historicalNoteIcon: {
    fontSize: 24,
  },
  historicalNoteContent: {
    flex: 1,
  },
  historicalNoteTitle: {
    color: "#f1f5f9",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 4,
  },
  historicalNoteText: {
    color: "#94a3b8",
    fontSize: 12,
    lineHeight: 18,
  },
  competitorsSection: {
    marginTop: 4,
  },
  competitorsHeaderRow: {
    marginBottom: 10,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0f172a",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#1e293b",
    marginBottom: 12,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: "#f8fafc",
    fontSize: 13,
    paddingVertical: 4,
  },
  searchClear: {
    color: "#94a3b8",
    fontSize: 14,
    paddingHorizontal: 6,
  },
  competitorsList: {
    gap: 8,
  },
  competitorRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0f172a",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  competitorRowWinner: {
    backgroundColor: "rgba(234, 179, 8, 0.08)",
    borderColor: "rgba(234, 179, 8, 0.35)",
  },
  competitorRowSelf: {
    backgroundColor: "rgba(56, 189, 248, 0.08)",
    borderColor: "rgba(56, 189, 248, 0.4)",
  },
  rankBox: {
    width: 30,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  medalText: {
    fontSize: 16,
  },
  rankNumberText: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "800",
  },
  competitorAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1e293b",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    marginRight: 10,
  },
  competitorAvatarEmoji: {
    fontSize: 18,
  },
  competitorInfo: {
    flex: 1,
  },
  competitorNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  competitorName: {
    color: "#f1f5f9",
    fontSize: 13,
    fontWeight: "700",
    maxWidth: "70%",
  },
  competitorRealName: {
    color: "#64748b",
    fontSize: 10,
    marginTop: 1,
  },
  selfTag: {
    backgroundColor: "#0284c7",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  selfTagText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "800",
  },
  winnerBadgeMini: {
    backgroundColor: "rgba(234, 179, 8, 0.2)",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: "#eab308",
  },
  winnerBadgeMiniText: {
    color: "#facc15",
    fontSize: 9,
    fontWeight: "800",
  },
  competitorPointsBox: {
    alignItems: "flex-end",
    marginLeft: 8,
  },
  competitorPointsText: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "900",
  },
  competitorPointsLabel: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: "700",
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#1e293b",
    backgroundColor: "#0f172a",
  },
  doneBtn: {
    backgroundColor: "#eab308",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  doneBtnText: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "900",
  },
});
