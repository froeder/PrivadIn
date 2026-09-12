import React, { useState, useEffect, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { AppUser, PoopcoinSupplySummary, PoopcoinTransaction } from "../types";
import {
  fetchPoopcoinSettings,
  fetchPoopcoinSupplySummary,
  formatPoopcoins,
  getActiveUsers,
  listenPoopcoinChainHead,
  listenPoopcoinTransactions,
  listenUserPoopcoinTransactions,
} from "../services/poopcoinService";
import PoopcoinWalletCard from "../components/PoopcoinWalletCard";
import TransferPoopcoinsModal from "../components/TransferPoopcoinsModal";

interface PoopcoinsScreenProps {
  user: AppUser;
  onRefreshUser: () => void;
}

function shortHash(hash: string): string {
  if (!hash) return "#";
  return hash.length > 16 ? `#${hash.slice(0, 6)}...${hash.slice(-6)}` : `#${hash}`;
}

function formatTxDate(createdAt: any): string {
  if (!createdAt) return "Hoje";
  let d: Date;
  if (typeof createdAt.toDate === "function") {
    d = createdAt.toDate();
  } else if (typeof createdAt === "number") {
    d = new Date(createdAt);
  } else if (createdAt.seconds) {
    d = new Date(createdAt.seconds * 1000);
  } else {
    d = new Date(createdAt);
  }
  if (isNaN(d.getTime())) return "Hoje";

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month} às ${hours}:${minutes}`;
}

export default function PoopcoinsScreen({
  user,
  onRefreshUser,
}: PoopcoinsScreenProps) {
  const [supply, setSupply] = useState<PoopcoinSupplySummary>({
    totalSupply: 1000000,
    mintedSupply: 0,
    burnedSupply: 0,
    circulatingSupply: 0,
    availableSupply: 1000000,
    supplyMigratedAt: null,
  });
  const [settings, setSettings] = useState<{
    poopcoinsPerLog: number;
    cuiterPostCost: number;
  }>({
    poopcoinsPerLog: 1,
    cuiterPostCost: 5,
  });
  const [allTransactions, setAllTransactions] = useState<PoopcoinTransaction[]>([]);
  const [userTransactions, setUserTransactions] = useState<PoopcoinTransaction[]>([]);
  const [usersMap, setUsersMap] = useState<Map<string, AppUser>>(new Map());
  const [activeTab, setActiveTab] = useState<"my" | "all">("my");
  const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Load active users map for name resolution
  const loadUsersMap = async () => {
    try {
      const list = await getActiveUsers();
      const map = new Map<string, AppUser>();
      list.forEach((u) => map.set(u.uid, u));
      setUsersMap(map);
    } catch (e) {
      console.error("Error loading users map:", e);
    }
  };

  const loadSettingsAndSupply = async () => {
    const [cfg, sup] = await Promise.all([
      fetchPoopcoinSettings(),
      fetchPoopcoinSupplySummary(),
    ]);
    setSettings(cfg);
    setSupply(sup);
  };

  useEffect(() => {
    loadUsersMap();
    loadSettingsAndSupply();

    const unsubHead = listenPoopcoinChainHead((newSummary) => {
      setSupply(newSummary);
    });

    const unsubAllTxs = listenPoopcoinTransactions((txs) => {
      setAllTransactions(txs);
    }, 40);

    const unsubUserTxs = listenUserPoopcoinTransactions(user.uid, (txs) => {
      setUserTransactions(txs);
    }, 40);

    return () => {
      unsubHead();
      unsubAllTxs();
      unsubUserTxs();
    };
  }, [user.uid]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      loadUsersMap(),
      loadSettingsAndSupply(),
      onRefreshUser(),
    ]);
    setRefreshing(false);
  };

  const handleCopyHash = async (hash: string) => {
    try {
      await Clipboard.setStringAsync(hash);
      Alert.alert("Hash Copiado!", `Hash da transação copiado:\n${hash}`);
    } catch {
      Alert.alert("Erro", "Não foi possível copiar o hash.");
    }
  };

  const displayedTransactions = activeTab === "my" ? userTransactions : allTransactions;

  // Resolve transaction display attributes
  const renderTxItem = (tx: PoopcoinTransaction) => {
    const isMine = tx.affectedUserIds?.includes(user.uid);
    const isSender = tx.fromUserId === user.uid;
    const isReceiver = tx.toUserId === user.uid;

    const fromUser = tx.fromUserId ? usersMap.get(tx.fromUserId) : null;
    const toUser = tx.toUserId ? usersMap.get(tx.toUserId) : null;

    const fromName = fromUser?.nickname || fromUser?.name || tx.fromUserId || "Anônimo";
    const toName = toUser?.nickname || toUser?.name || tx.toUserId || "Anônimo";

    let icon = "🪙";
    let typeLabel = "Movimentação";
    let deltaSign = "";
    let isPositive = false;
    let description = "";

    switch (tx.type) {
      case "mint_log":
      case "legacy_mint":
        icon = "🚽";
        typeLabel = "Registro no Trono";
        deltaSign = "+";
        isPositive = true;
        description = isMine ? "Moeda ganha pelo expediente sagrado" : `${toName} minerou no trono`;
        break;

      case "transfer":
        icon = "💸";
        if (isSender) {
          typeLabel = "Transferência Enviada";
          deltaSign = "-";
          isPositive = false;
          description = `Para: ${toName}`;
        } else if (isReceiver) {
          typeLabel = "Transferência Recebida";
          deltaSign = "+";
          isPositive = true;
          description = `De: ${fromName}`;
        } else {
          typeLabel = "Transferência";
          deltaSign = "";
          description = `${fromName} ➔ ${toName}`;
        }
        break;

      case "cuiter_spend":
        icon = "💬";
        typeLabel = "Post no Cuiter";
        deltaSign = "-";
        isPositive = false;
        description = isMine ? "Moedas queimadas na publicação" : `${fromName} postou no Cuiter`;
        break;

      case "admin_adjustment":
        icon = "⚙️";
        typeLabel = "Ajuste Administrativo";
        const entry = tx.entries?.find((e) => e.userId === user.uid);
        if (entry) {
          isPositive = entry.delta > 0;
          deltaSign = isPositive ? "+" : "";
        }
        description = tx.reason || "Ajuste de saldo";
        break;

      case "reversal":
        icon = "↩️";
        typeLabel = "Reversão";
        description = `Reversão de transação anterior`;
        break;

      default:
        typeLabel = tx.type;
        description = "Operação do sistema";
        break;
    }

    return (
      <View key={tx.id || tx.hash} style={styles.txCard}>
        <View style={styles.txLeft}>
          <View
            style={[
              styles.txIconContainer,
              isPositive ? styles.txIconPos : styles.txIconNeg,
            ]}
          >
            <Text style={styles.txEmoji}>{icon}</Text>
          </View>
          <View style={styles.txDetails}>
            <View style={styles.txTypeRow}>
              <Text style={styles.txTypeLabel}>{typeLabel}</Text>
              <TouchableOpacity onPress={() => handleCopyHash(tx.hash)}>
                <Text style={styles.txHashBadge}>{shortHash(tx.hash)}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.txDescription} numberOfLines={1}>
              {description}
            </Text>

            {/* Motivo ou Mensagem se houver */}
            {tx.reason && (
              <View style={styles.txReasonBox}>
                <Text style={styles.txReasonText}>💬 "{tx.reason}"</Text>
              </View>
            )}

            <Text style={styles.txDate}>{formatTxDate(tx.createdAt)}</Text>
          </View>
        </View>

        <View style={styles.txRight}>
          <Text
            style={[
              styles.txAmount,
              isPositive ? styles.txAmountPos : styles.txAmountNeg,
            ]}
          >
            {deltaSign}
            {formatPoopcoins(tx.amount)} PC
          </Text>
        </View>
      </View>
    );
  };

  const mintedPercent = Math.min(
    100,
    Math.round((supply.mintedSupply / (supply.totalSupply || 1)) * 100)
  );

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#eab308"
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>🪙 Poopcoins & Economia</Text>
          <Text style={styles.headerSubtitle}>
            A moeda virtual das suas horas no trono
          </Text>
        </View>
      </View>

      {/* Hero Wallet Card */}
      <PoopcoinWalletCard
        user={user}
        onOpenTransfer={() => setTransferModalVisible(true)}
      />

      {/* Metrics of the System Card */}
      <View style={styles.metricsCard}>
        <View style={styles.metricsHeader}>
          <View>
            <Text style={styles.metricsBadge}>📊 MÉTRICAS DO SISTEMA</Text>
            <Text style={styles.metricsTitle}>Suprimento Poopcoin</Text>
          </View>
        </View>

        {/* Progress Bar of Minted Supply */}
        <View style={styles.progressBarWrapper}>
          <View style={styles.progressLabels}>
            <Text style={styles.progressLabelLeft}>
              Emitidas: {formatPoopcoins(supply.mintedSupply)} PC ({mintedPercent}%)
            </Text>
            <Text style={styles.progressLabelRight}>
              Teto: {formatPoopcoins(supply.totalSupply)} PC
            </Text>
          </View>
          <View style={styles.progressBarTrack}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${Math.max(2, mintedPercent)}%` },
              ]}
            />
          </View>
        </View>

        {/* 4 Supply Grid Items */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricItem}>
            <Text style={styles.metricItemValue}>
              {formatPoopcoins(supply.totalSupply)}
            </Text>
            <Text style={styles.metricItemLabel}>Supply Total</Text>
            <Text style={styles.metricItemHint}>Oferta fixa</Text>
          </View>

          <View style={styles.metricItem}>
            <Text style={styles.metricItemValue}>
              {formatPoopcoins(supply.mintedSupply)}
            </Text>
            <Text style={styles.metricItemLabel}>Emitidas</Text>
            <Text style={styles.metricItemHint}>Em carteiras</Text>
          </View>

          <View style={styles.metricItem}>
            <Text style={styles.metricItemValue}>
              {formatPoopcoins(supply.burnedSupply)}
            </Text>
            <Text style={styles.metricItemLabel}>Queimadas</Text>
            <Text style={styles.metricItemHint}>Destruídas</Text>
          </View>

          <View style={styles.metricItem}>
            <Text style={[styles.metricItemValue, { color: "#4ade80" }]}>
              {formatPoopcoins(supply.availableSupply)}
            </Text>
            <Text style={styles.metricItemLabel}>Disponíveis</Text>
            <Text style={styles.metricItemHint}>Para minerar</Text>
          </View>
        </View>

        {/* Transaction Cost / Reward Rules */}
        <View style={styles.rulesRow}>
          <View style={styles.rulePill}>
            <Text style={styles.rulePillEmoji}>🚽</Text>
            <Text style={styles.rulePillText}>
              Ganho por Trono:{" "}
              <Text style={styles.ruleHighlight}>
                +{formatPoopcoins(settings.poopcoinsPerLog)} PC
              </Text>
            </Text>
          </View>
          <View style={styles.rulePill}>
            <Text style={styles.rulePillEmoji}>💬</Text>
            <Text style={styles.rulePillText}>
              Custo Cuiter:{" "}
              <Text style={styles.ruleHighlight}>
                -{formatPoopcoins(settings.cuiterPostCost)} PC
              </Text>
            </Text>
          </View>
        </View>
      </View>

      {/* Transaction Ledger Section */}
      <View style={styles.ledgerSection}>
        <View style={styles.ledgerHeader}>
          <View>
            <Text style={styles.ledgerBadge}>⛓️ LEDGER PÚBLICO</Text>
            <Text style={styles.ledgerTitle}>Extrato de Transações</Text>
          </View>
        </View>

        {/* Tabs: My Transactions vs All Blockchain */}
        <View style={styles.tabToggleRow}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === "my" && styles.tabBtnActive]}
            onPress={() => setActiveTab("my")}
          >
            <Text
              style={[
                styles.tabBtnText,
                activeTab === "my" && styles.tabBtnTextActive,
              ]}
            >
              Minhas ({userTransactions.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === "all" && styles.tabBtnActive]}
            onPress={() => setActiveTab("all")}
          >
            <Text
              style={[
                styles.tabBtnText,
                activeTab === "all" && styles.tabBtnTextActive,
              ]}
            >
              Blockchain Geral ({allTransactions.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Transactions List */}
        {displayedTransactions.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📭</Text>
            <Text style={styles.emptyTitle}>Nenhuma transação encontrada</Text>
            <Text style={styles.emptySubtitle}>
              {activeTab === "my"
                ? "Você ainda não realizou ou recebeu transferências."
                : "Nenhuma transação foi minerada no ledger ainda."}
            </Text>
          </View>
        ) : (
          displayedTransactions.map(renderTxItem)
        )}
      </View>

      {/* Transfer Modal */}
      <TransferPoopcoinsModal
        visible={transferModalVisible}
        currentUser={user}
        onClose={() => setTransferModalVisible(false)}
        onSuccess={() => {
          onRefreshUser();
          loadSettingsAndSupply();
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: "#020617",
    flexGrow: 1,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    marginTop: 6,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#f8fafc",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#94a3b8",
    marginTop: 2,
  },
  // Metrics Card
  metricsCard: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
  },
  metricsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  metricsBadge: {
    color: "#38bdf8",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  metricsTitle: {
    color: "#f8fafc",
    fontSize: 17,
    fontWeight: "900",
    marginTop: 2,
  },
  progressBarWrapper: {
    marginBottom: 16,
  },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  progressLabelLeft: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "600",
  },
  progressLabelRight: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "600",
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: "#1e293b",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#eab308",
    borderRadius: 4,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  metricItem: {
    width: "48%",
    backgroundColor: "#1e293b",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#334155",
  },
  metricItemValue: {
    color: "#f8fafc",
    fontSize: 16,
    fontWeight: "800",
  },
  metricItemLabel: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },
  metricItemHint: {
    color: "#64748b",
    fontSize: 10,
    marginTop: 1,
  },
  rulesRow: {
    flexDirection: "row",
    gap: 8,
  },
  rulePill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: "#334155",
  },
  rulePillEmoji: {
    fontSize: 14,
  },
  rulePillText: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "600",
  },
  ruleHighlight: {
    color: "#f8fafc",
    fontWeight: "800",
  },
  // Ledger
  ledgerSection: {
    marginTop: 4,
  },
  ledgerHeader: {
    marginBottom: 12,
  },
  ledgerBadge: {
    color: "#a855f7",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  ledgerTitle: {
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 2,
  },
  tabToggleRow: {
    flexDirection: "row",
    backgroundColor: "#0f172a",
    borderRadius: 14,
    padding: 4,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: "center",
  },
  tabBtnActive: {
    backgroundColor: "#1e293b",
  },
  tabBtnText: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
  },
  tabBtnTextActive: {
    color: "#eab308",
    fontWeight: "800",
  },
  // Tx Card
  txCard: {
    backgroundColor: "#0f172a",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1e293b",
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  txLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    flex: 1,
  },
  txIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  txIconPos: {
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.3)",
  },
  txIconNeg: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  txEmoji: {
    fontSize: 18,
  },
  txDetails: {
    flex: 1,
  },
  txTypeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  txTypeLabel: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "800",
  },
  txHashBadge: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: "600",
    fontFamily: "monospace",
    backgroundColor: "#1e293b",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  txDescription: {
    color: "#94a3b8",
    fontSize: 12,
    marginTop: 2,
  },
  txReasonBox: {
    backgroundColor: "#1e293b",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 4,
    alignSelf: "flex-start",
  },
  txReasonText: {
    color: "#e2e8f0",
    fontSize: 11,
    fontStyle: "italic",
  },
  txDate: {
    color: "#64748b",
    fontSize: 10,
    marginTop: 4,
  },
  txRight: {
    marginLeft: 10,
    alignItems: "flex-end",
  },
  txAmount: {
    fontSize: 14,
    fontWeight: "900",
  },
  txAmountPos: {
    color: "#4ade80",
  },
  txAmountNeg: {
    color: "#f87171",
  },
  // Empty
  emptyState: {
    backgroundColor: "#0f172a",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#1e293b",
    borderStyle: "dashed",
    padding: 30,
    alignItems: "center",
  },
  emptyEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyTitle: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "800",
  },
  emptySubtitle: {
    color: "#64748b",
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
  },
});
