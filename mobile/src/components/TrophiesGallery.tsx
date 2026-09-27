import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { toRoman } from "../utils/roman";
import { normalizeWonEditions } from "../utils/editions";
import { EditionRecord } from "../types";
import { getEditionDetails } from "../services/editionService";
import { EditionDetailsModal } from "./EditionDetailsModal";

interface TrophiesGalleryProps {
  wonEditions?: number[] | any;
  themeColor?: string;
  isOwnProfile?: boolean;
  currentUserUid?: string;
  userName?: string;
}

export function TrophiesGallery({
  wonEditions,
  themeColor = "#eab308",
  isOwnProfile = true,
  currentUserUid,
  userName,
}: TrophiesGalleryProps) {
  const normalized = normalizeWonEditions(wonEditions);
  const count = normalized.length;

  const [selectedRecord, setSelectedRecord] = useState<EditionRecord | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [loadingEdition, setLoadingEdition] = useState<number | null>(null);

  const handleOpenEdition = async (edNum: number) => {
    try {
      setLoadingEdition(edNum);
      const record = await getEditionDetails(edNum);
      setSelectedRecord(record);
      setModalVisible(true);
    } catch (err) {
      console.warn("Erro ao abrir detalhes da edição:", err);
    } finally {
      setLoadingEdition(null);
    }
  };

  return (
    <View style={styles.wrapper}>
      {/* Header da Seção de Troféus */}
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderLeft}>
          <Text style={styles.sectionTitle}>🏆 SALA DE TROFÉUS DO TRONO</Text>
          <Text style={styles.sectionSubtitle}>
            {count > 0
              ? `${count} ${count === 1 ? "troféu oficial conquistado" : "troféus oficiais conquistados"}`
              : "Dispute a liderança semanal para ganhar troféus"}
          </Text>
        </View>
        {count > 0 && (
          <View style={[styles.countBadge, { borderColor: `${themeColor}60` }]}>
            <Text style={[styles.countBadgeText, { color: themeColor }]}>
              {count}x Campeão 👑
            </Text>
          </View>
        )}
      </View>

      {/* Galeria de Troféus Conquistados */}
      {count > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.trophiesScroll}
        >
          {normalized.map((edNum) => {
            const roman = toRoman(edNum);
            const isLoadingThis = loadingEdition === edNum;

            return (
              <TouchableOpacity
                key={edNum}
                style={[
                  styles.trophyCard,
                  { borderColor: `${themeColor}60` },
                ]}
                activeOpacity={0.8}
                onPress={() => handleOpenEdition(edNum)}
                disabled={isLoadingThis}
              >
                {/* Brilho Superior / Pedestal Dourado */}
                <View style={styles.trophyGlowBackground} />

                {/* Ícone de Troféu */}
                <View style={styles.trophyIconWrap}>
                  <Text style={styles.trophyEmoji}>🏆</Text>
                  <View style={styles.crownPill}>
                    <Text style={styles.crownText}>1º</Text>
                  </View>
                </View>

                {/* Título da Edição */}
                <Text style={styles.editionRomanText}>Edição {roman}</Text>
                <Text style={styles.editionNumberSub}>#{edNum}</Text>

                <View style={styles.cardDivider} />

                {/* Botão / Ação */}
                <View style={styles.actionRow}>
                  {isLoadingThis ? (
                    <ActivityIndicator size="small" color="#facc15" />
                  ) : (
                    <>
                      <Text style={styles.actionText}>Ver Disputa</Text>
                      <Text style={styles.actionArrow}>›</Text>
                    </>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : (
        /* Estado Vazio de Troféus com Silhueta */
        <View style={styles.emptyCard}>
          <View style={styles.emptyIconWrap}>
            <Text style={styles.emptyIcon}>🏆</Text>
          </View>
          <View style={styles.emptyContent}>
            <Text style={styles.emptyTitle}>Nenhum troféu de campeão ainda</Text>
            <Text style={styles.emptyDescription}>
              {isOwnProfile
                ? "Toda semana o ranking é resetado. O competidor com mais pontos leva a coroa e um troféu eterno para esta galeria!"
                : `${userName || "Este colaborador"} ainda não conquistou troféus de edições encerradas.`}
            </Text>
          </View>
        </View>
      )}

      {/* Modal de Detalhes da Edição */}
      <EditionDetailsModal
        visible={modalVisible}
        editionRecord={selectedRecord}
        currentUserUid={currentUserUid}
        onClose={() => {
          setModalVisible(false);
          setSelectedRecord(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    marginTop: 14,
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  sectionHeaderLeft: {
    flex: 1,
    marginRight: 8,
  },
  sectionTitle: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  sectionSubtitle: {
    color: "#94a3b8",
    fontSize: 11,
    marginTop: 2,
  },
  countBadge: {
    backgroundColor: "rgba(234, 179, 8, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: "800",
  },
  trophiesScroll: {
    paddingVertical: 4,
    paddingHorizontal: 2,
    gap: 12,
  },
  trophyCard: {
    width: 144,
    backgroundColor: "rgba(15, 23, 42, 0.95)",
    borderRadius: 18,
    padding: 14,
    alignItems: "center",
    borderWidth: 1.5,
    overflow: "hidden",
    position: "relative",
    shadowColor: "#eab308",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  trophyGlowBackground: {
    position: "absolute",
    top: -30,
    width: 100,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(234, 179, 8, 0.18)",
  },
  trophyIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(234, 179, 8, 0.14)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "rgba(234, 179, 8, 0.4)",
    marginBottom: 10,
    position: "relative",
  },
  trophyEmoji: {
    fontSize: 30,
  },
  crownPill: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#eab308",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
  },
  crownText: {
    color: "#0f172a",
    fontSize: 9,
    fontWeight: "900",
  },
  editionRomanText: {
    color: "#fef08a",
    fontSize: 14,
    fontWeight: "900",
    textAlign: "center",
  },
  editionNumberSub: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 1,
  },
  cardDivider: {
    width: "100%",
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    marginVertical: 10,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  actionText: {
    color: "#facc15",
    fontSize: 11,
    fontWeight: "800",
  },
  actionArrow: {
    color: "#facc15",
    fontSize: 14,
    fontWeight: "900",
  },
  emptyCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(30, 41, 59, 0.5)",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(100, 116, 139, 0.25)",
    gap: 14,
  },
  emptyIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(100, 116, 139, 0.3)",
    opacity: 0.6,
  },
  emptyIcon: {
    fontSize: 24,
  },
  emptyContent: {
    flex: 1,
  },
  emptyTitle: {
    color: "#e2e8f0",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 4,
  },
  emptyDescription: {
    color: "#94a3b8",
    fontSize: 11,
    lineHeight: 16,
  },
});
