import React, { useState, useEffect, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { AppUser } from "../types";
import {
  formatPoopcoins,
  getActiveUsers,
  transferPoopcoins,
} from "../services/poopcoinService";

interface TransferPoopcoinsModalProps {
  visible: boolean;
  currentUser: AppUser;
  initialRecipientUser?: AppUser | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function TransferPoopcoinsModal({
  visible,
  currentUser,
  initialRecipientUser,
  onClose,
  onSuccess,
}: TransferPoopcoinsModalProps) {
  const [activeUsers, setActiveUsers] = useState<AppUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(initialRecipientUser || null);
  const [manualUid, setManualUid] = useState("");
  const [amount, setAmount] = useState("5");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [manualMode, setManualMode] = useState(false);

  const balance = Number(currentUser.poopcoinBalance ?? 0);

  useEffect(() => {
    if (visible) {
      loadUsers();
      setAmount("5");
      setReason("");
      setSelectedUser(initialRecipientUser || null);
      setManualUid("");
      setManualMode(false);
    }
  }, [visible, initialRecipientUser]);


  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const users = await getActiveUsers();
      setActiveUsers(users.filter((u) => u.uid !== currentUser.uid));
    } catch (e) {
      console.error("Error loading users for transfer:", e);
    } finally {
      setLoadingUsers(false);
    }
  };

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return activeUsers;
    const q = searchQuery.toLowerCase();
    return activeUsers.filter(
      (u) =>
        u.name?.toLowerCase().includes(q) ||
        u.nickname?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q)
    );
  }, [activeUsers, searchQuery]);

  const handleSelectQuickAmount = (val: number) => {
    setAmount(String(val));
  };

  const handleSetMaxAmount = () => {
    // Use Math.floor to ensure whole number only (transfer only accepts integers)
    setAmount(String(Math.max(0, Math.floor(balance))));
  };

  const handleConfirmTransfer = async () => {
    const targetUid = manualMode ? manualUid.trim() : selectedUser?.uid;

    if (!targetUid) {
      Alert.alert("Atenção", "Selecione um colega ou informe o ID de destino.");
      return;
    }

    if (targetUid === currentUser.uid) {
      Alert.alert("Erro", "Você não pode transferir Poopcoins para si mesmo.");
      return;
    }

    const numAmount = parseInt(amount, 10);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert("Erro", "Informe uma quantidade inteira maior que zero.");
      return;
    }

    if (numAmount > balance) {
      Alert.alert(
        "Saldo Insuficiente",
        `Você possui ${formatPoopcoins(balance)} PC. Ajuste o valor a transferir.`
      );
      return;
    }

    const recipientName =
      selectedUser?.nickname?.trim() || selectedUser?.name || targetUid;

    Alert.alert(
      "Confirmar Transferência",
      `Deseja enviar ${formatPoopcoins(numAmount)} Poopcoins para ${recipientName}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Confirmar Envio",
          style: "default",
          onPress: async () => {
            setSubmitting(true);
            try {
              await transferPoopcoins(currentUser, targetUid, numAmount, reason);
              Alert.alert(
                "Transferência Realizada! 🚀",
                `Você transferiu ${formatPoopcoins(numAmount)} PC com sucesso!`
              );
              onSuccess();
              onClose();
            } catch (err: any) {
              console.error(err);
              Alert.alert(
                "Falha na Transferência",
                err?.message || "Não foi possível concluir a transferência."
              );
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>💸 Transferir Poopcoins</Text>
              <Text style={styles.modalSubtitle}>
                Seu saldo disponível:{" "}
                <Text style={styles.modalBalanceHighlight}>
                  {formatPoopcoins(balance)} PC
                </Text>
              </Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* Destinatário Section */}
            <Text style={styles.sectionLabel}>1. Escolha o Colega</Text>

            <View style={styles.modeToggleRow}>
              <TouchableOpacity
                style={[styles.modeBtn, !manualMode && styles.modeBtnActive]}
                onPress={() => {
                  setManualMode(false);
                  setManualUid("");
                }}
              >
                <Text style={[styles.modeBtnText, !manualMode && styles.modeBtnTextActive]}>
                  👥 Lista de Colegas
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeBtn, manualMode && styles.modeBtnActive]}
                onPress={() => {
                  setManualMode(true);
                  setSelectedUser(null);
                }}
              >
                <Text style={[styles.modeBtnText, manualMode && styles.modeBtnTextActive]}>
                  🆔 Digitar ID
                </Text>
              </TouchableOpacity>
            </View>

            {!manualMode ? (
              <View>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar colega por nome ou email..."
                  placeholderTextColor="#64748b"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />

                {loadingUsers ? (
                  <ActivityIndicator color="#eab308" style={{ marginVertical: 14 }} />
                ) : (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.userListScroll}
                  >
                    {filteredUsers.map((user) => {
                      const isSelected = selectedUser?.uid === user.uid;
                      const initial = (user.name || "C").charAt(0).toUpperCase();
                      return (
                        <TouchableOpacity
                          key={user.uid}
                          style={[
                            styles.userCard,
                            isSelected && styles.userCardSelected,
                          ]}
                          onPress={() => setSelectedUser(user)}
                        >
                          <View
                            style={[
                              styles.userAvatar,
                              isSelected && styles.userAvatarSelected,
                            ]}
                          >
                            <Text style={styles.userAvatarText}>{initial}</Text>
                          </View>
                          <Text
                            style={[
                              styles.userNameText,
                              isSelected && styles.userNameTextSelected,
                            ]}
                            numberOfLines={1}
                          >
                            {user.nickname || user.name || "Colega"}
                          </Text>
                          <Text style={styles.userBalanceHint} numberOfLines={1}>
                            {formatPoopcoins(user.poopcoinBalance || 0)} PC
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}

                {selectedUser && (
                  <View style={styles.selectionFeedback}>
                    <Text style={styles.selectionFeedbackText}>
                      Destinatário selecionado:{" "}
                      <Text style={styles.selectionFeedbackName}>
                        {selectedUser.name}
                      </Text>
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.manualUidContainer}>
                <TextInput
                  style={styles.textInput}
                  placeholder="Cole ou digite o UID do usuário..."
                  placeholderTextColor="#64748b"
                  value={manualUid}
                  onChangeText={setManualUid}
                  autoCapitalize="none"
                />
              </View>
            )}

            {/* Quantidade Section */}
            <Text style={[styles.sectionLabel, { marginTop: 18 }]}>
              2. Quantidade de Poopcoins
            </Text>

            <TextInput
              style={styles.amountInput}
              keyboardType="number-pad"
              value={amount}
              onChangeText={setAmount}
              placeholder="Ex: 10"
              placeholderTextColor="#64748b"
            />

            {/* Quick Amount Pills */}
            <View style={styles.quickPillsRow}>
              {[1, 5, 10, 50, 100].map((val) => (
                <TouchableOpacity
                  key={val}
                  style={[
                    styles.quickPill,
                    amount === String(val) && styles.quickPillActive,
                  ]}
                  onPress={() => handleSelectQuickAmount(val)}
                >
                  <Text
                    style={[
                      styles.quickPillText,
                      amount === String(val) && styles.quickPillTextActive,
                    ]}
                  >
                    +{val}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[
                  styles.quickPill,
                  amount === String(balance) && styles.quickPillActive,
                ]}
                onPress={handleSetMaxAmount}
              >
                <Text
                  style={[
                    styles.quickPillText,
                    amount === String(balance) && styles.quickPillTextActive,
                  ]}
                >
                  Tudo
                </Text>
              </TouchableOpacity>
            </View>

            {/* Mensagem / Motivo Section */}
            <Text style={[styles.sectionLabel, { marginTop: 18 }]}>
              3. Mensagem ou Motivo (Opcional)
            </Text>
            <TextInput
              style={styles.reasonInput}
              placeholder="Ex: Valeu pelo café, parceiro! ou Parabéns pelo sprint"
              placeholderTextColor="#64748b"
              value={reason}
              onChangeText={setReason}
              maxLength={240}
              multiline
              numberOfLines={2}
            />
            <Text style={styles.counterText}>{reason.length}/240 caracteres</Text>

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                submitting && styles.submitButtonDisabled,
              ]}
              onPress={handleConfirmTransfer}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#020617" />
              ) : (
                <Text style={styles.submitButtonText}>
                  🚀 Confirmar Envio de Poopcoins
                </Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 23, 0.85)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#0f172a",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: "#1e293b",
    padding: 22,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#f8fafc",
  },
  modalSubtitle: {
    fontSize: 13,
    color: "#94a3b8",
    marginTop: 4,
  },
  modalBalanceHighlight: {
    color: "#eab308",
    fontWeight: "800",
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#1e293b",
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonText: {
    color: "#94a3b8",
    fontSize: 16,
    fontWeight: "700",
  },
  modalBody: {
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#eab308",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  modeToggleRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: "#1e293b",
    borderRadius: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#334155",
  },
  modeBtnActive: {
    borderColor: "#eab308",
    backgroundColor: "rgba(234, 179, 8, 0.12)",
  },
  modeBtnText: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
  },
  modeBtnTextActive: {
    color: "#eab308",
  },
  searchInput: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: "#f8fafc",
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#334155",
    marginBottom: 10,
  },
  userListScroll: {
    flexDirection: "row",
    marginVertical: 4,
  },
  userCard: {
    backgroundColor: "#1e293b",
    borderRadius: 14,
    padding: 10,
    alignItems: "center",
    marginRight: 10,
    width: 88,
    borderWidth: 1,
    borderColor: "#334155",
  },
  userCardSelected: {
    borderColor: "#eab308",
    backgroundColor: "rgba(234, 179, 8, 0.15)",
  },
  userAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "#475569",
  },
  userAvatarSelected: {
    borderColor: "#eab308",
    backgroundColor: "#eab308",
  },
  userAvatarText: {
    color: "#f8fafc",
    fontWeight: "800",
    fontSize: 16,
  },
  userNameText: {
    color: "#f8fafc",
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
  userNameTextSelected: {
    color: "#eab308",
  },
  userBalanceHint: {
    color: "#64748b",
    fontSize: 10,
    marginTop: 2,
    fontWeight: "600",
  },
  selectionFeedback: {
    backgroundColor: "rgba(234, 179, 8, 0.1)",
    padding: 10,
    borderRadius: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.3)",
  },
  selectionFeedbackText: {
    color: "#cbd5e1",
    fontSize: 12,
  },
  selectionFeedbackName: {
    color: "#eab308",
    fontWeight: "800",
  },
  manualUidContainer: {
    marginVertical: 4,
  },
  textInput: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#f8fafc",
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#334155",
  },
  amountInput: {
    backgroundColor: "#1e293b",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#f8fafc",
    fontSize: 22,
    fontWeight: "800",
    borderWidth: 1,
    borderColor: "#334155",
    textAlign: "center",
  },
  quickPillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
    justifyContent: "center",
  },
  quickPill: {
    backgroundColor: "#1e293b",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#334155",
    minWidth: 46,
    alignItems: "center",
  },
  quickPillActive: {
    borderColor: "#eab308",
    backgroundColor: "rgba(234, 179, 8, 0.18)",
  },
  quickPillText: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
  },
  quickPillTextActive: {
    color: "#eab308",
    fontWeight: "800",
  },
  reasonInput: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: "#f8fafc",
    fontSize: 13,
    borderWidth: 1,
    borderColor: "#334155",
    minHeight: 56,
    textAlignVertical: "top",
  },
  counterText: {
    color: "#64748b",
    fontSize: 11,
    textAlign: "right",
    marginTop: 4,
  },
  submitButton: {
    backgroundColor: "#eab308",
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    marginBottom: 24,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: "#020617",
    fontSize: 15,
    fontWeight: "900",
  },
});
