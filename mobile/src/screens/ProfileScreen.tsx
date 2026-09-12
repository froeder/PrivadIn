import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { AppUser } from "../types";
import { signOutUser } from "../services/authService";
import { updateUserSalary } from "../services/poopService";

interface ProfileScreenProps {
  user: AppUser;
  onRefreshUser: () => void;
}

export default function ProfileScreen({ user, onRefreshUser }: ProfileScreenProps) {
  const [salaryInput, setSalaryInput] = useState(
    user.salary ? String(user.salary) : "3000"
  );
  const [saving, setSaving] = useState(false);

  const handleSaveSalary = async () => {
    const num = parseFloat(salaryInput.replace(",", "."));
    if (isNaN(num) || num <= 0) {
      Alert.alert("Erro", "Insira um salário válido.");
      return;
    }

    setSaving(true);
    try {
      await updateUserSalary(user.uid, num);
      Alert.alert("Sucesso", "Salário e valor/hora atualizados!");
      onRefreshUser();
    } catch (error: any) {
      console.error(error);
      Alert.alert("Erro", "Não foi possível salvar o salário.");
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert("Sair", "Deseja realmente sair da sua conta?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sair",
        style: "destructive",
        onPress: async () => {
          await signOutUser();
        },
      },
    ]);
  };

  const hourlyRate = user.hourlyRate || (user.salary ? user.salary / 176 : 20);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Profile Header */}
      <View style={styles.profileHeader}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>
            {(user.name || "C").charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.userName}>{user.name || "Cagador Anônimo"}</Text>
        <Text style={styles.userEmail}>{user.email}</Text>
      </View>

      {/* Stats Grid */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Estatísticas da Carreira</Text>
        <View style={styles.statsGrid}>
          <View style={styles.gridItem}>
            <Text style={styles.gridValue}>{user.totalPoints || 0}</Text>
            <Text style={styles.gridLabel}>Pontos Totais</Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.gridValue}>{user.currentDailyStreak || 0} 🔥</Text>
            <Text style={styles.gridLabel}>Dias Seguidos</Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.gridValue}>{user.poopcoinBalance || 0} 💩</Text>
            <Text style={styles.gridLabel}>Poopcoins</Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.gridValue}>R$ {hourlyRate.toFixed(2)}</Text>
            <Text style={styles.gridLabel}>Por Hora</Text>
          </View>
        </View>
      </View>

      {/* Salary Setting */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Configuração Salarial</Text>
        <Text style={styles.cardDescription}>
          Defina seu salário mensal para calcularmos exatamente quanto você fatura por minuto no trono.
        </Text>

        <View style={styles.inputRow}>
          <View style={styles.currencyPrefix}>
            <Text style={styles.currencyText}>R$</Text>
          </View>
          <TextInput
            style={styles.salaryInput}
            value={salaryInput}
            onChangeText={setSalaryInput}
            keyboardType="numeric"
            placeholder="3000"
            placeholderTextColor="#64748b"
          />
        </View>

        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSaveSalary}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#020617" />
          ) : (
            <Text style={styles.saveButtonText}>Salvar Salário</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* App Info & Logout */}
      <View style={styles.footerSection}>
        <Text style={styles.versionText}>PrivadIn Mobile v1.0.0 • Expo EAS</Text>

        <TouchableOpacity style={styles.logoutButton} onPress={handleSignOut}>
          <Text style={styles.logoutText}>Encerrar Sessão</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: "#020617",
    flexGrow: 1,
  },
  profileHeader: {
    alignItems: "center",
    marginBottom: 24,
    marginTop: 10,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#1e293b",
    borderWidth: 2,
    borderColor: "#eab308",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: "900",
    color: "#eab308",
  },
  userName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#f8fafc",
  },
  userEmail: {
    fontSize: 13,
    color: "#94a3b8",
    marginTop: 2,
  },
  card: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#f8fafc",
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 13,
    color: "#94a3b8",
    marginBottom: 16,
    lineHeight: 18,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  gridItem: {
    width: "47%",
    backgroundColor: "#1e293b",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
  },
  gridValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#f8fafc",
  },
  gridLabel: {
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 4,
    fontWeight: "600",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  currencyPrefix: {
    backgroundColor: "#1e293b",
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
    borderRightWidth: 0,
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: "center",
  },
  currencyText: {
    color: "#94a3b8",
    fontWeight: "700",
    fontSize: 16,
  },
  salaryInput: {
    flex: 1,
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#f8fafc",
    fontSize: 16,
    fontWeight: "700",
  },
  saveButton: {
    backgroundColor: "#eab308",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  saveButtonText: {
    color: "#020617",
    fontWeight: "800",
    fontSize: 14,
  },
  footerSection: {
    alignItems: "center",
    marginTop: 10,
    marginBottom: 20,
  },
  versionText: {
    color: "#64748b",
    fontSize: 12,
    marginBottom: 16,
  },
  logoutButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    backgroundColor: "rgba(239, 68, 68, 0.08)",
  },
  logoutText: {
    color: "#f87171",
    fontWeight: "700",
    fontSize: 14,
  },
});
