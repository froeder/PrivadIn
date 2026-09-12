import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { AppUser } from "../types";
import { formatPoopcoins } from "../services/poopcoinService";

interface PoopcoinWalletCardProps {
  user: AppUser;
  onOpenTransfer?: () => void;
  onViewLedger?: () => void;
  compact?: boolean;
}

export default function PoopcoinWalletCard({
  user,
  onOpenTransfer,
  onViewLedger,
  compact = false,
}: PoopcoinWalletCardProps) {
  const [copied, setCopied] = useState(false);
  const balance = Number(user.poopcoinBalance ?? 0);

  const handleCopyUid = async () => {
    try {
      await Clipboard.setStringAsync(user.uid);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      Alert.alert("ID Copiado!", "Seu ID foi copiado. Envie para colegas transferirem Poopcoins para você.");
    } catch {
      Alert.alert("Erro", "Não foi possível copiar o ID.");
    }
  };

  if (compact) {
    return (
      <TouchableOpacity
        style={styles.compactCard}
        onPress={onViewLedger}
        activeOpacity={0.8}
      >
        <View style={styles.compactLeft}>
          <Text style={styles.compactIcon}>🪙</Text>
          <View>
            <Text style={styles.compactLabel}>Carteira Poopcoins</Text>
            <Text style={styles.compactBalance}>
              {formatPoopcoins(balance)} <Text style={styles.pcUnit}>PC</Text>
            </Text>
          </View>
        </View>
        {onOpenTransfer && (
          <TouchableOpacity
            style={styles.compactActionBtn}
            onPress={(e) => {
              e.stopPropagation();
              onOpenTransfer();
            }}
          >
            <Text style={styles.compactActionText}>Transferir</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.card}>
      {/* Top Tag & Balance */}
      <View style={styles.headerRow}>
        <View style={styles.badgeRow}>
          <Text style={styles.cardBadgeText}>🪙 CARTEIRA VIRTUAL</Text>
        </View>
        <TouchableOpacity style={styles.copyPill} onPress={handleCopyUid}>
          <Text style={styles.copyPillText}>
            {copied ? "✓ Copiado!" : "📋 Copiar meu ID"}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.balanceContainer}>
        <Text style={styles.balanceNumber}>{formatPoopcoins(balance)}</Text>
        <Text style={styles.balanceUnit}>POOPCOINS (PC)</Text>
      </View>

      {/* User UID code block */}
      <View style={styles.uidContainer}>
        <Text style={styles.uidLabel}>Seu ID para receber:</Text>
        <Text style={styles.uidValue} numberOfLines={1}>
          {user.uid}
        </Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsRow}>
        {onOpenTransfer && (
          <TouchableOpacity
            style={[styles.actionBtn, styles.primaryBtn]}
            onPress={onOpenTransfer}
            activeOpacity={0.85}
          >
            <Text style={styles.primaryBtnText}>💸 Enviar Poopcoins</Text>
          </TouchableOpacity>
        )}
        {onViewLedger && (
          <TouchableOpacity
            style={[styles.actionBtn, styles.secondaryBtn]}
            onPress={onViewLedger}
            activeOpacity={0.85}
          >
            <Text style={styles.secondaryBtnText}>📜 Extrato</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#0f172a",
    borderWidth: 1.5,
    borderColor: "rgba(234, 179, 8, 0.35)",
    borderRadius: 22,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#eab308",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  badgeRow: {
    backgroundColor: "rgba(234, 179, 8, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.3)",
  },
  cardBadgeText: {
    color: "#eab308",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  copyPill: {
    backgroundColor: "#1e293b",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#334155",
  },
  copyPillText: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "700",
  },
  balanceContainer: {
    marginVertical: 6,
  },
  balanceNumber: {
    fontSize: 36,
    fontWeight: "900",
    color: "#f8fafc",
    letterSpacing: -0.5,
  },
  balanceUnit: {
    fontSize: 12,
    fontWeight: "800",
    color: "#eab308",
    letterSpacing: 1.2,
    marginTop: 2,
  },
  uidContainer: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginVertical: 12,
  },
  uidLabel: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  uidValue: {
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "monospace",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtn: {
    backgroundColor: "#eab308",
  },
  primaryBtnText: {
    color: "#020617",
    fontSize: 14,
    fontWeight: "900",
  },
  secondaryBtn: {
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
  },
  secondaryBtnText: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "700",
  },
  // Compact style
  compactCard: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.25)",
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  compactLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  compactIcon: {
    fontSize: 28,
  },
  compactLabel: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "600",
  },
  compactBalance: {
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: "900",
  },
  pcUnit: {
    color: "#eab308",
    fontSize: 12,
    fontWeight: "800",
  },
  compactActionBtn: {
    backgroundColor: "rgba(234, 179, 8, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.4)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  compactActionText: {
    color: "#eab308",
    fontSize: 12,
    fontWeight: "800",
  },
});
