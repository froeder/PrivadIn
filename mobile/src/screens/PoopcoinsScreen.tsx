import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import {
  AppUser,
  PoopcoinSupplySummary,
  PoopcoinTransaction,
  ShopItem,
  ShopItemCategory,
} from "../types";
import {
  fetchPoopcoinSettings,
  fetchPoopcoinSupplySummary,
  formatPoopcoins,
  getActiveUsers,
  listenPoopcoinChainHead,
  listenPoopcoinTransactions,
  listenUserPoopcoinTransactions,
  SHOP_CATALOG,
  buyShopItem,
  equipUserItem,
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
  const [moduleTab, setModuleTab] = useState<"ledger" | "shop" | "metrics">("ledger");
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
  const [ledgerSubTab, setLedgerSubTab] = useState<"my" | "all">("my");
  const [shopCategory, setShopCategory] = useState<"all" | ShopItemCategory>("all");
  const [selectedShopItem, setSelectedShopItem] = useState<ShopItem | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [equipping, setEquipping] = useState(false);
  const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const balance = Number(user.poopcoinBalance ?? 0);

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
    try {
      const [cfg, sup] = await Promise.all([
        fetchPoopcoinSettings(),
        fetchPoopcoinSupplySummary(),
      ]);
      setSettings(cfg);
      setSupply(sup);
    } catch (e) {
      console.error("Error loading poopcoin settings/supply:", e);
    }
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
    try {
      await Promise.all([
        loadUsersMap(),
        loadSettingsAndSupply(),
        onRefreshUser(),
      ]);
    } catch (e) {
      console.error("Error during refresh:", e);
    } finally {
      setRefreshing(false);
    }
  };

  const handleCopyHash = async (hash: string) => {
    try {
      await Clipboard.setStringAsync(hash);
      Alert.alert("Hash Copiado!", `Hash da transação copiado:\n${hash}`);
    } catch {
      Alert.alert("Erro", "Não foi possível copiar o hash.");
    }
  };

  const handleConfirmPurchase = async () => {
    if (!selectedShopItem) return;
    setPurchasing(true);
    try {
      await buyShopItem(user, selectedShopItem);
      Alert.alert(
        "🎉 Compra Realizada!",
        `Você adquiriu "${selectedShopItem.name}" por ${formatPoopcoins(selectedShopItem.price)} PC!`
      );
      setSelectedShopItem(null);
      await Promise.all([onRefreshUser(), loadSettingsAndSupply()]);
    } catch (err: any) {
      Alert.alert("Falha na Compra", err?.message || "Não foi possível adquirir o item.");
    } finally {
      setPurchasing(false);
    }
  };

  const handleToggleEquip = async (item: ShopItem) => {
    setEquipping(true);
    try {
      const isEquipped =
        item.category === "title"
          ? user.equippedTitle === item.name
          : user.equippedBadge === item.icon;

      await equipUserItem(user.uid, item, !isEquipped);
      await onRefreshUser();
    } catch (err: any) {
      Alert.alert("Erro", err?.message || "Não foi possível equipar o item.");
    } finally {
      setEquipping(false);
    }
  };

  const displayedTransactions =
    ledgerSubTab === "my" ? userTransactions : allTransactions;

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
        description = isMine
          ? "Moeda ganha pelo expediente sagrado"
          : `${toName} minerou no trono`;
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
        if (tx.reason?.startsWith("Loja:")) {
          icon = "🛒";
          typeLabel = "Compra na Loja";
          deltaSign = "-";
          isPositive = false;
          description = tx.reason;
        } else {
          icon = "💬";
          typeLabel = "Post no Cuiter";
          deltaSign = "-";
          isPositive = false;
          description = isMine
            ? "Moedas queimadas na publicação"
            : `${fromName} postou no Cuiter`;
        }
        break;

      case "admin_adjustment": {
        icon = "⚙️";
        typeLabel = "Ajuste Administrativo";
        const entry = tx.entries?.find((e) => e.userId === user.uid);
        if (entry) {
          isPositive = entry.delta > 0;
          deltaSign = isPositive ? "+" : "";
        }
        description = tx.reason || "Ajuste de saldo";
        break;
      }

      case "reversal": {
        icon = "↩️";
        typeLabel = "Reversão";
        // Check entries to determine if the reversal credits or debits the user
        const reversalEntry = tx.entries?.find((e) => e.userId === user.uid);
        if (reversalEntry) {
          isPositive = reversalEntry.delta > 0;
          deltaSign = isPositive ? "+" : "";
        }
        description = `Reversão de transação anterior`;
        break;
      }

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

  const filteredShopItems = SHOP_CATALOG.filter((item) => {
    if (shopCategory === "all") return true;
    return item.category === shopCategory;
  });

  const getRarityBadgeStyle = (rarity: string) => {
    switch (rarity) {
      case "lendario":
        return { border: "#eab308", bg: "rgba(234, 179, 8, 0.15)", text: "#facc15" };
      case "epico":
        return { border: "#c084fc", bg: "rgba(192, 132, 252, 0.15)", text: "#d8b4fe" };
      case "raro":
        return { border: "#38bdf8", bg: "rgba(56, 189, 248, 0.15)", text: "#7dd3fc" };
      default:
        return { border: "#64748b", bg: "rgba(100, 116, 139, 0.15)", text: "#94a3b8" };
    }
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
          <Text style={styles.headerTitle}>🪙 Poopcoins & Loja</Text>
          <Text style={styles.headerSubtitle}>
            A economia e recompensas das suas horas no trono
          </Text>
        </View>
      </View>

      {/* Main Module Segment Tabs */}
      <View style={styles.moduleNavRow}>
        <TouchableOpacity
          style={[styles.moduleNavBtn, moduleTab === "ledger" && styles.moduleNavBtnActive]}
          onPress={() => setModuleTab("ledger")}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.moduleNavText,
              moduleTab === "ledger" && styles.moduleNavTextActive,
            ]}
          >
            📜 Extrato & Carteira
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.moduleNavBtn, moduleTab === "shop" && styles.moduleNavBtnActive]}
          onPress={() => setModuleTab("shop")}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.moduleNavText,
              moduleTab === "shop" && styles.moduleNavTextActive,
            ]}
          >
            🛒 Loja do Trono
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.moduleNavBtn, moduleTab === "metrics" && styles.moduleNavBtnActive]}
          onPress={() => setModuleTab("metrics")}
          activeOpacity={0.8}
        >
          <Text
            style={[
              styles.moduleNavText,
              moduleTab === "metrics" && styles.moduleNavTextActive,
            ]}
          >
            📊 Métricas
          </Text>
        </TouchableOpacity>
      </View>

      {/* =================================================================== */}
      {/* TAB 1: EXTRATO & CARTEIRA */}
      {/* =================================================================== */}
      {moduleTab === "ledger" && (
        <View>
          {/* Hero Wallet Card */}
          <PoopcoinWalletCard
            user={user}
            onOpenTransfer={() => setTransferModalVisible(true)}
          />

          {/* Transaction Ledger Section */}
          <View style={styles.ledgerSection}>
            <View style={styles.ledgerHeader}>
              <View>
                <Text style={styles.ledgerBadge}>⛓️ LEDGER PÚBLICO</Text>
                <Text style={styles.ledgerTitle}>Extrato de Transações</Text>
              </View>
            </View>

            {/* Sub-tabs: My Transactions vs All Blockchain */}
            <View style={styles.tabToggleRow}>
              <TouchableOpacity
                style={[styles.tabBtn, ledgerSubTab === "my" && styles.tabBtnActive]}
                onPress={() => setLedgerSubTab("my")}
              >
                <Text
                  style={[
                    styles.tabBtnText,
                    ledgerSubTab === "my" && styles.tabBtnTextActive,
                  ]}
                >
                  Minhas ({userTransactions.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabBtn, ledgerSubTab === "all" && styles.tabBtnActive]}
                onPress={() => setLedgerSubTab("all")}
              >
                <Text
                  style={[
                    styles.tabBtnText,
                    ledgerSubTab === "all" && styles.tabBtnTextActive,
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
                  {ledgerSubTab === "my"
                    ? "Você ainda não realizou transações. Registre uma cagada ou envie moedas para começar!"
                    : "Nenhuma transação foi minerada no ledger ainda."}
                </Text>
              </View>
            ) : (
              displayedTransactions.map(renderTxItem)
            )}
          </View>
        </View>
      )}

      {/* =================================================================== */}
      {/* TAB 2: LOJA DE RECOMPENSAS */}
      {/* =================================================================== */}
      {moduleTab === "shop" && (
        <View style={styles.shopSection}>
          {/* Shop Balance Bar */}
          <View style={styles.shopBalanceCard}>
            <View>
              <Text style={styles.shopBalanceLabel}>SEU SALDO PARA GASTAR</Text>
              <Text style={styles.shopBalanceValue}>
                {formatPoopcoins(balance)} <Text style={styles.shopBalanceUnit}>PC</Text>
              </Text>
            </View>
            <TouchableOpacity
              style={styles.shopTransferBtn}
              onPress={() => setTransferModalVisible(true)}
            >
              <Text style={styles.shopTransferBtnText}>💸 Transferir</Text>
            </TouchableOpacity>
          </View>

          {/* Equipped Status Banner */}
          {(user.equippedTitle || user.equippedBadge) && (
            <View style={styles.equippedBanner}>
              <Text style={styles.equippedBannerTitle}>✨ ITENS EQUIPADOS NO SEU PERFIL</Text>
              <View style={styles.equippedPillsRow}>
                {user.equippedTitle && (
                  <View style={styles.equippedPill}>
                    <Text style={styles.equippedPillText}>👑 {user.equippedTitle}</Text>
                  </View>
                )}
                {user.equippedBadge && (
                  <View style={styles.equippedPill}>
                    <Text style={styles.equippedPillText}>{user.equippedBadge} Badge Ativa</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Category Filter Pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryScroll}
          >
            {[
              { key: "all", label: "✨ Tudo" },
              { key: "title", label: "👑 Títulos" },
              { key: "badge", label: "🥇 Badges & Molduras" },
              { key: "perk", label: "☕ Privilégios Corporativos" },
            ].map((cat) => (
              <TouchableOpacity
                key={cat.key}
                style={[
                  styles.categoryPill,
                  shopCategory === cat.key && styles.categoryPillActive,
                ]}
                onPress={() => setShopCategory(cat.key as any)}
              >
                <Text
                  style={[
                    styles.categoryPillText,
                    shopCategory === cat.key && styles.categoryPillTextActive,
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Shop Items List */}
          <View style={styles.shopGrid}>
            {filteredShopItems.map((item) => {
              const isOwned = user.unlockedItems?.includes(item.id);
              const isEquipped =
                item.category === "title"
                  ? user.equippedTitle === item.name
                  : item.category === "badge"
                  ? user.equippedBadge === item.icon
                  : false;

              const canAfford = balance >= item.price;
              const rarityStyle = getRarityBadgeStyle(item.rarity);

              return (
                <View key={item.id} style={styles.shopItemCard}>
                  <View style={styles.shopItemTop}>
                    <View
                      style={[
                        styles.shopItemIconContainer,
                        { borderColor: rarityStyle.border, backgroundColor: rarityStyle.bg },
                      ]}
                    >
                      <Text style={styles.shopItemIcon}>{item.icon}</Text>
                    </View>

                    <View style={styles.shopItemInfo}>
                      <View style={styles.shopItemTitleRow}>
                        <Text style={styles.shopItemName}>{item.name}</Text>
                        <View
                          style={[
                            styles.rarityBadge,
                            { borderColor: rarityStyle.border, backgroundColor: rarityStyle.bg },
                          ]}
                        >
                          <Text style={[styles.rarityBadgeText, { color: rarityStyle.text }]}>
                            {item.rarity.toUpperCase()}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.shopItemDescription}>
                        {item.description}
                      </Text>

                      {item.perkEffect && (
                        <View style={styles.perkEffectBox}>
                          <Text style={styles.perkEffectText}>
                            ✨ {item.perkEffect}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Price & Action Bottom Row */}
                  <View style={styles.shopItemBottom}>
                    <View style={styles.shopPriceBox}>
                      <Text style={styles.shopPriceText}>
                        🪙 {formatPoopcoins(item.price)} PC
                      </Text>
                    </View>

                    {isOwned ? (
                      item.category === "perk" ? (
                        <View style={styles.ownedBadge}>
                          <Text style={styles.ownedBadgeText}>✓ Desbloqueado</Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={[
                            styles.equipBtn,
                            isEquipped && styles.equipBtnActive,
                          ]}
                          onPress={() => handleToggleEquip(item)}
                          disabled={equipping}
                        >
                          <Text
                            style={[
                              styles.equipBtnText,
                              isEquipped && styles.equipBtnTextActive,
                            ]}
                          >
                            {isEquipped ? "✓ Equipado" : "Equipar"}
                          </Text>
                        </TouchableOpacity>
                      )
                    ) : (
                      <TouchableOpacity
                        style={[
                          styles.buyBtn,
                          !canAfford && styles.buyBtnDisabled,
                        ]}
                        onPress={() => setSelectedShopItem(item)}
                        disabled={!canAfford}
                      >
                        <Text
                          style={[
                            styles.buyBtnText,
                            !canAfford && styles.buyBtnTextDisabled,
                          ]}
                        >
                          {canAfford ? "Comprar" : `Faltam ${item.price - balance} PC`}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* =================================================================== */}
      {/* TAB 3: MÉTRICAS DA ECONOMIA */}
      {/* =================================================================== */}
      {moduleTab === "metrics" && (
        <View>
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
                <Text style={styles.metricItemHint}>Destruídas na loja</Text>
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

          {/* Blockchain & Transparency Info */}
          <View style={styles.blockchainExplainerCard}>
            <Text style={styles.explainerTitle}>🔐 Como Funciona a Blockchain do PrivadIn?</Text>
            <Text style={styles.explainerText}>
              • Cada cagada registrada gera Poopcoins legítimos minerados em blocos interligados por hash SHA-256.{"\n"}
              • A oferta é limitada a 1.000.000 de Poopcoins — sem inflação desenfreada.{"\n"}
              • As compras na Loja de Recompensas e posts no Cuiter queimam moedas de verdade, reduzindo o suprimento circulante.
            </Text>
          </View>
        </View>
      )}

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

      {/* Purchase Confirmation Modal */}
      {selectedShopItem && (
        <Modal
          visible={true}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setSelectedShopItem(null)}
        >
          <View style={styles.purchaseModalOverlay}>
            <View style={styles.purchaseModalCard}>
              <Text style={styles.purchaseModalEmoji}>{selectedShopItem.icon}</Text>
              <Text style={styles.purchaseModalTitle}>{selectedShopItem.name}</Text>
              <Text style={styles.purchaseModalDesc}>{selectedShopItem.description}</Text>

              <View style={styles.purchaseSummaryBox}>
                <View style={styles.purchaseSummaryRow}>
                  <Text style={styles.summaryRowLabel}>Preço do Item:</Text>
                  <Text style={styles.summaryRowValue}>
                    {formatPoopcoins(selectedShopItem.price)} PC
                  </Text>
                </View>
                <View style={styles.purchaseSummaryRow}>
                  <Text style={styles.summaryRowLabel}>Seu Saldo Atual:</Text>
                  <Text style={styles.summaryRowValue}>{formatPoopcoins(balance)} PC</Text>
                </View>
                <View style={[styles.purchaseSummaryRow, { borderTopWidth: 1, borderTopColor: "#334155", paddingTop: 8, marginTop: 4 }]}>
                  <Text style={styles.summaryRowLabel}>Saldo Após Compra:</Text>
                  <Text style={[styles.summaryRowValue, { color: "#4ade80" }]}>
                    {formatPoopcoins(Math.max(0, balance - selectedShopItem.price))} PC
                  </Text>
                </View>
              </View>

              <View style={styles.purchaseActionsRow}>
                <TouchableOpacity
                  style={styles.purchaseCancelBtn}
                  onPress={() => setSelectedShopItem(null)}
                  disabled={purchasing}
                >
                  <Text style={styles.purchaseCancelBtnText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.purchaseConfirmBtn}
                  onPress={handleConfirmPurchase}
                  disabled={purchasing}
                >
                  {purchasing ? (
                    <ActivityIndicator color="#020617" />
                  ) : (
                    <Text style={styles.purchaseConfirmBtnText}>Confirmar Compra 🚀</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
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
  // Module Navigation Row
  moduleNavRow: {
    flexDirection: "row",
    backgroundColor: "#0f172a",
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#1e293b",
    gap: 4,
  },
  moduleNavBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  moduleNavBtnActive: {
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.4)",
  },
  moduleNavText: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "700",
  },
  moduleNavTextActive: {
    color: "#eab308",
    fontWeight: "900",
  },
  // Shop Styles
  shopSection: {
    marginBottom: 20,
  },
  shopBalanceCard: {
    backgroundColor: "#0f172a",
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "rgba(234, 179, 8, 0.3)",
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  shopBalanceLabel: {
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  shopBalanceValue: {
    color: "#f8fafc",
    fontSize: 26,
    fontWeight: "900",
    marginTop: 2,
  },
  shopBalanceUnit: {
    color: "#eab308",
    fontSize: 14,
    fontWeight: "800",
  },
  shopTransferBtn: {
    backgroundColor: "rgba(234, 179, 8, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.4)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  shopTransferBtnText: {
    color: "#eab308",
    fontSize: 12,
    fontWeight: "800",
  },
  equippedBanner: {
    backgroundColor: "#1e293b",
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#334155",
  },
  equippedBannerTitle: {
    color: "#eab308",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  equippedPillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  equippedPill: {
    backgroundColor: "#0f172a",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.35)",
  },
  equippedPillText: {
    color: "#f8fafc",
    fontSize: 11,
    fontWeight: "700",
  },
  categoryScroll: {
    flexDirection: "row",
    marginBottom: 14,
  },
  categoryPill: {
    backgroundColor: "#0f172a",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  categoryPillActive: {
    backgroundColor: "rgba(234, 179, 8, 0.15)",
    borderColor: "#eab308",
  },
  categoryPillText: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
  },
  categoryPillTextActive: {
    color: "#eab308",
    fontWeight: "900",
  },
  shopGrid: {
    gap: 12,
  },
  shopItemCard: {
    backgroundColor: "#0f172a",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#1e293b",
    padding: 16,
  },
  shopItemTop: {
    flexDirection: "row",
    gap: 12,
  },
  shopItemIconContainer: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  shopItemIcon: {
    fontSize: 22,
  },
  shopItemInfo: {
    flex: 1,
  },
  shopItemTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  shopItemName: {
    color: "#f8fafc",
    fontSize: 15,
    fontWeight: "800",
    flex: 1,
  },
  rarityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    marginLeft: 6,
  },
  rarityBadgeText: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  shopItemDescription: {
    color: "#94a3b8",
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  perkEffectBox: {
    backgroundColor: "rgba(234, 179, 8, 0.1)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 6,
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.25)",
    alignSelf: "flex-start",
  },
  perkEffectText: {
    color: "#facc15",
    fontSize: 11,
    fontWeight: "700",
  },
  shopItemBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#1e293b",
  },
  shopPriceBox: {
    backgroundColor: "#1e293b",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  shopPriceText: {
    color: "#eab308",
    fontSize: 13,
    fontWeight: "900",
  },
  buyBtn: {
    backgroundColor: "#eab308",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  buyBtnDisabled: {
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
  },
  buyBtnText: {
    color: "#020617",
    fontSize: 12,
    fontWeight: "900",
  },
  buyBtnTextDisabled: {
    color: "#64748b",
    fontWeight: "700",
  },
  equipBtn: {
    backgroundColor: "#1e293b",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#334155",
  },
  equipBtnActive: {
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    borderColor: "#22c55e",
  },
  equipBtnText: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
  },
  equipBtnTextActive: {
    color: "#4ade80",
    fontWeight: "900",
  },
  ownedBadge: {
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.3)",
  },
  ownedBadgeText: {
    color: "#4ade80",
    fontSize: 11,
    fontWeight: "800",
  },
  // Purchase Modal
  purchaseModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 23, 0.85)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  purchaseModalCard: {
    backgroundColor: "#0f172a",
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: "rgba(234, 179, 8, 0.4)",
    padding: 22,
    width: "100%",
    maxWidth: 380,
    alignItems: "center",
  },
  purchaseModalEmoji: {
    fontSize: 44,
    marginBottom: 8,
  },
  purchaseModalTitle: {
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
  },
  purchaseModalDesc: {
    color: "#94a3b8",
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 16,
  },
  purchaseSummaryBox: {
    backgroundColor: "#1e293b",
    borderRadius: 14,
    padding: 14,
    width: "100%",
    marginBottom: 18,
  },
  purchaseSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  summaryRowLabel: {
    color: "#94a3b8",
    fontSize: 12,
  },
  summaryRowValue: {
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "800",
  },
  purchaseActionsRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  purchaseCancelBtn: {
    flex: 1,
    backgroundColor: "#1e293b",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  purchaseCancelBtnText: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: "700",
  },
  purchaseConfirmBtn: {
    flex: 1.4,
    backgroundColor: "#eab308",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  purchaseConfirmBtnText: {
    color: "#020617",
    fontSize: 13,
    fontWeight: "900",
  },
  // Metrics Card
  metricsCard: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
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
  blockchainExplainerCard: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
  },
  explainerTitle: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 8,
  },
  explainerText: {
    color: "#94a3b8",
    fontSize: 12,
    lineHeight: 18,
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
