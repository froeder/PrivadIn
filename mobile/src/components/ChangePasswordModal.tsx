import React, { useState, useEffect } from "react";
import {
  Modal,
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from "react-native";
import {
  KeyRound,
  Mail,
  X,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
} from "lucide-react-native";
import {
  changePasswordForCurrentUser,
  sendPasswordResetForCurrentUser,
} from "../services/authService";

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail?: string;
  themeColor?: string;
}

export default function ChangePasswordModal({
  isOpen,
  onClose,
  userEmail,
  themeColor = "#eab308",
}: ChangePasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowCurrent(false);
      setShowNew(false);
      setShowConfirm(false);
      setError(null);
      setSuccessMessage(null);
    }
  }, [isOpen]);

  const handleClose = () => {
    if (isSubmitting || isSendingReset) return;
    setError(null);
    setSuccessMessage(null);
    onClose();
  };

  const handleSubmit = async () => {
    setError(null);
    setSuccessMessage(null);

    if (!currentPassword) {
      setError("Informe a sua senha atual.");
      return;
    }

    if (newPassword.length < 6) {
      setError("A nova senha deve ter no mínimo 6 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("A confirmação da nova senha não confere.");
      return;
    }

    if (currentPassword === newPassword) {
      setError("A nova senha não pode ser igual à senha atual.");
      return;
    }

    setIsSubmitting(true);
    try {
      await changePasswordForCurrentUser(currentPassword, newPassword);
      setSuccessMessage("Senha alterada com sucesso!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (err: any) {
      console.error(err);
      if (
        err.code === "auth/wrong-password" ||
        err.code === "auth/invalid-credential"
      ) {
        setError("Senha atual incorreta.");
      } else if (err.code === "auth/weak-password") {
        setError("A nova senha é muito fraca. Use pelo menos 6 caracteres.");
      } else if (err.code === "auth/requires-recent-login") {
        setError("Por segurança, saia e entre novamente no app antes de trocar a senha.");
      } else {
        setError(err.message || "Erro ao alterar a senha.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendResetEmail = async () => {
    setIsSendingReset(true);
    setError(null);

    try {
      await sendPasswordResetForCurrentUser();
      Alert.alert(
        "E-mail Enviado! 📧",
        `Um link de redefinição de senha foi enviado para ${userEmail || "seu e-mail"}. Verifique sua caixa de entrada e spam.`
      );
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Erro ao enviar e-mail de redefinição.");
    } finally {
      setIsSendingReset(false);
    }
  };

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.overlay}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={handleClose}
        />
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={[styles.iconBox, { backgroundColor: `${themeColor}20` }]}>
                <KeyRound size={20} color={themeColor} />
              </View>
              <View>
                <Text style={styles.title}>Alterar Senha</Text>
                <Text style={styles.subtitle}>
                  Atualize a senha de acesso da sua conta
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={handleClose}
              disabled={isSubmitting || isSendingReset}
              style={styles.closeBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={20} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Feedback Messages */}
            {error && (
              <View style={styles.errorBox}>
                <AlertCircle size={18} color="#ef4444" style={{ marginTop: 1 }} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {successMessage && (
              <View style={styles.successBox}>
                <CheckCircle2 size={18} color="#22c55e" style={{ marginTop: 1 }} />
                <Text style={styles.successText}>{successMessage}</Text>
              </View>
            )}

            {/* Email notice */}
            {userEmail && (
              <View style={styles.emailNotice}>
                <Text style={styles.emailNoticeLabel}>Conta:</Text>
                <Text style={styles.emailNoticeValue} numberOfLines={1}>
                  {userEmail}
                </Text>
              </View>
            )}

            {/* Input: Senha Atual */}
            <Text style={styles.inputLabel}>Senha Atual</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.inputField}
                placeholder="Digite sua senha atual"
                placeholderTextColor="#64748b"
                secureTextEntry={!showCurrent}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={() => setShowCurrent(!showCurrent)}
                style={styles.eyeBtn}
              >
                {showCurrent ? (
                  <EyeOff size={18} color="#94a3b8" />
                ) : (
                  <Eye size={18} color="#94a3b8" />
                )}
              </TouchableOpacity>
            </View>

            {/* Input: Nova Senha */}
            <Text style={[styles.inputLabel, { marginTop: 14 }]}>
              Nova Senha (mínimo 6 caracteres)
            </Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.inputField}
                placeholder="Digite a nova senha"
                placeholderTextColor="#64748b"
                secureTextEntry={!showNew}
                value={newPassword}
                onChangeText={setNewPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={() => setShowNew(!showNew)}
                style={styles.eyeBtn}
              >
                {showNew ? (
                  <EyeOff size={18} color="#94a3b8" />
                ) : (
                  <Eye size={18} color="#94a3b8" />
                )}
              </TouchableOpacity>
            </View>

            {/* Input: Confirmar Nova Senha */}
            <Text style={[styles.inputLabel, { marginTop: 14 }]}>
              Confirmar Nova Senha
            </Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.inputField}
                placeholder="Repita a nova senha"
                placeholderTextColor="#64748b"
                secureTextEntry={!showConfirm}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={() => setShowConfirm(!showConfirm)}
                style={styles.eyeBtn}
              >
                {showConfirm ? (
                  <EyeOff size={18} color="#94a3b8" />
                ) : (
                  <Eye size={18} color="#94a3b8" />
                )}
              </TouchableOpacity>
            </View>

            {/* Action Buttons */}
            <TouchableOpacity
              style={[
                styles.submitBtn,
                { backgroundColor: themeColor },
                (isSubmitting || isSendingReset) && { opacity: 0.7 },
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting || isSendingReset}
              activeOpacity={0.85}
            >
              {isSubmitting ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color="#020617" />
                  <Text style={styles.submitBtnText}>Atualizando senha...</Text>
                </View>
              ) : (
                <Text style={styles.submitBtnText}>Salvar Nova Senha</Text>
              )}
            </TouchableOpacity>

            {/* Forgot current password option */}
            <View style={styles.forgotSection}>
              <Text style={styles.forgotPrompt}>
                Esqueceu sua senha atual?
              </Text>
              <TouchableOpacity
                onPress={handleSendResetEmail}
                disabled={isSubmitting || isSendingReset}
                style={styles.forgotLink}
              >
                {isSendingReset ? (
                  <ActivityIndicator size="small" color={themeColor} />
                ) : (
                  <View style={styles.forgotLinkRow}>
                    <Mail size={14} color={themeColor} />
                    <Text style={[styles.forgotLinkText, { color: themeColor }]}>
                      Enviar link de redefinição por e-mail
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 23, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 24,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "900",
    color: "#f8fafc",
  },
  subtitle: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  emailNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  emailNoticeLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748b",
  },
  emailNoticeValue: {
    fontSize: 12,
    fontWeight: "600",
    color: "#cbd5e1",
    flex: 1,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#cbd5e1",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 14,
    paddingHorizontal: 12,
  },
  inputField: {
    flex: 1,
    height: 46,
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "600",
  },
  eyeBtn: {
    padding: 6,
  },
  submitBtn: {
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  submitBtnText: {
    color: "#020617",
    fontSize: 14,
    fontWeight: "900",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    padding: 10,
    borderRadius: 12,
    marginBottom: 14,
  },
  errorText: {
    color: "#f87171",
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
    lineHeight: 16,
  },
  successBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.3)",
    padding: 10,
    borderRadius: 12,
    marginBottom: 14,
  },
  successText: {
    color: "#4ade80",
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
    lineHeight: 16,
  },
  forgotSection: {
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
  },
  forgotPrompt: {
    fontSize: 12,
    color: "#94a3b8",
  },
  forgotLink: {
    marginTop: 6,
    paddingVertical: 4,
  },
  forgotLinkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  forgotLinkText: {
    fontSize: 12,
    fontWeight: "800",
    textDecorationLine: "underline",
  },
});
