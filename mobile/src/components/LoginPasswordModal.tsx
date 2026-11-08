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
  sendPasswordReset,
  changePasswordWithCredentials,
} from "../services/authService";

interface LoginPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialEmail?: string;
  onPasswordChanged?: (email: string) => void;
}

export default function LoginPasswordModal({
  isOpen,
  onClose,
  initialEmail = "",
  onPasswordChanged,
}: LoginPasswordModalProps) {
  const [tab, setTab] = useState<"email" | "direct">("email");
  const [email, setEmail] = useState(initialEmail);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailSentTo, setEmailSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setEmail(initialEmail);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowCurrent(false);
      setShowNew(false);
      setShowConfirm(false);
      setEmailSentTo(null);
      setError(null);
      setSuccessMessage(null);
    }
  }, [isOpen, initialEmail]);

  const handleClose = () => {
    if (isSubmitting) return;
    setError(null);
    setSuccessMessage(null);
    onClose();
  };

  const handleSendResetEmail = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Informe o seu e-mail.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await sendPasswordReset(trimmedEmail);
      setEmailSentTo(trimmedEmail);
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/user-not-found") {
        setError("Nenhuma conta encontrada com este e-mail.");
      } else if (err.code === "auth/invalid-email") {
        setError("Formato de e-mail inválido.");
      } else {
        setError(err.message || "Erro ao enviar e-mail de redefinição.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDirectChange = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Informe o seu e-mail.");
      return;
    }
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
    setError(null);

    try {
      await changePasswordWithCredentials(trimmedEmail, currentPassword, newPassword);
      setSuccessMessage("Senha alterada com sucesso! Entre com sua nova senha.");
      onPasswordChanged?.(trimmedEmail);
      setTimeout(() => {
        handleClose();
      }, 1800);
    } catch (err: any) {
      console.error(err);
      if (
        err.code === "auth/invalid-credential" ||
        err.code === "auth/wrong-password"
      ) {
        setError("Senha atual incorreta.");
      } else if (err.code === "auth/user-not-found") {
        setError("Nenhum usuário encontrado com este e-mail.");
      } else {
        setError(err.message || "Erro ao alterar a senha. Tente novamente.");
      }
    } finally {
      setIsSubmitting(false);
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
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.backdrop}
      >
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIconWrapper}>
              <KeyRound size={22} color="#eab308" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>Alterar ou Redefinir Senha</Text>
              <Text style={styles.modalSubtitle}>
                Recupere ou troque a senha da sua conta
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleClose}
              disabled={isSubmitting}
              style={styles.closeButton}
            >
              <X size={20} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          {/* Tab Selector */}
          <View style={styles.tabsContainer}>
            <TouchableOpacity
              style={[styles.tabButton, tab === "email" && styles.tabButtonActive]}
              onPress={() => {
                setTab("email");
                setError(null);
              }}
            >
              <Mail
                size={15}
                color={tab === "email" ? "#020617" : "#94a3b8"}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.tabText, tab === "email" && styles.tabTextActive]}>
                Por E-mail
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, tab === "direct" && styles.tabButtonActive]}
              onPress={() => {
                setTab("direct");
                setError(null);
              }}
            >
              <KeyRound
                size={15}
                color={tab === "direct" ? "#020617" : "#94a3b8"}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.tabText, tab === "direct" && styles.tabTextActive]}>
                Trocar Agora
              </Text>
            </TouchableOpacity>
          </View>

          {/* Feedback messages */}
          {error && (
            <View style={styles.errorBox}>
              <AlertCircle size={16} color="#fca5a5" style={{ marginRight: 6 }} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {successMessage && (
            <View style={styles.successBox}>
              <CheckCircle2 size={16} color="#86efac" style={{ marginRight: 6 }} />
              <Text style={styles.successText}>{successMessage}</Text>
            </View>
          )}

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 10 }}
          >
            {tab === "email" ? (
              emailSentTo ? (
                <View style={styles.sentContainer}>
                  <View style={styles.successIconBubble}>
                    <CheckCircle2 size={32} color="#22c55e" />
                  </View>
                  <Text style={styles.sentTitle}>E-mail enviado com sucesso!</Text>
                  <Text style={styles.sentDescription}>
                    Enviamos as instruções para{"\n"}
                    <Text style={{ fontWeight: "700", color: "#f8fafc" }}>
                      {emailSentTo}
                    </Text>
                    .{"\n"}Abra o link recebido para cadastrar sua nova senha.
                  </Text>

                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={handleClose}
                  >
                    <Text style={styles.primaryButtonText}>
                      Entendido, voltar para o login
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.linkButton}
                    onPress={() => setEmailSentTo(null)}
                  >
                    <Text style={styles.linkButtonText}>
                      Enviar para outro e-mail
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View>
                  <Text style={styles.helperText}>
                    Digite seu e-mail cadastrado. Você receberá um link seguro do
                    Firebase para redefinir sua senha.
                  </Text>

                  <Text style={styles.label}>E-mail</Text>
                  <View style={styles.inputWrapper}>
                    <Mail size={18} color="#eab308" style={{ marginRight: 10 }} />
                    <TextInput
                      style={styles.input}
                      value={email}
                      onChangeText={setEmail}
                      placeholder="seu@email.com"
                      placeholderTextColor="#64748b"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.primaryButton, isSubmitting && styles.buttonDisabled]}
                    onPress={handleSendResetEmail}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator color="#020617" />
                    ) : (
                      <Text style={styles.primaryButtonText}>
                        Enviar link de alteração de senha
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              )
            ) : (
              <View>
                <Text style={styles.helperText}>
                  Se você lembra sua senha atual e quer trocá-la agora mesmo, preencha
                  os dados abaixo:
                </Text>

                <Text style={styles.label}>E-mail</Text>
                <View style={styles.inputWrapper}>
                  <Mail size={18} color="#eab308" style={{ marginRight: 10 }} />
                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="seu@email.com"
                    placeholderTextColor="#64748b"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <Text style={styles.label}>Senha Atual</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    placeholder="Sua senha atual"
                    placeholderTextColor="#64748b"
                    secureTextEntry={!showCurrent}
                  />
                  <TouchableOpacity onPress={() => setShowCurrent(!showCurrent)}>
                    {showCurrent ? (
                      <EyeOff size={18} color="#94a3b8" />
                    ) : (
                      <Eye size={18} color="#94a3b8" />
                    )}
                  </TouchableOpacity>
                </View>

                <Text style={styles.label}>Nova Senha (mín. 6 caracteres)</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="Nova senha"
                    placeholderTextColor="#64748b"
                    secureTextEntry={!showNew}
                  />
                  <TouchableOpacity onPress={() => setShowNew(!showNew)}>
                    {showNew ? (
                      <EyeOff size={18} color="#94a3b8" />
                    ) : (
                      <Eye size={18} color="#94a3b8" />
                    )}
                  </TouchableOpacity>
                </View>

                <Text style={styles.label}>Confirmar Nova Senha</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Repita a nova senha"
                    placeholderTextColor="#64748b"
                    secureTextEntry={!showConfirm}
                  />
                  <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)}>
                    {showConfirm ? (
                      <EyeOff size={18} color="#94a3b8" />
                    ) : (
                      <Eye size={18} color="#94a3b8" />
                    )}
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[styles.primaryButton, isSubmitting && styles.buttonDisabled]}
                  onPress={handleDirectChange}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#020617" />
                  ) : (
                    <Text style={styles.primaryButtonText}>
                      Alterar senha agora
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 23, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 440,
    backgroundColor: "#0f172a",
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: "#1e293b",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 8,
    maxHeight: "90%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },
  headerIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(234, 179, 8, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#f8fafc",
  },
  modalSubtitle: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 2,
  },
  closeButton: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "#1e293b",
  },
  tabsContainer: {
    flexDirection: "row",
    backgroundColor: "#1e293b",
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 9,
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: "#eab308",
  },
  tabText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#94a3b8",
  },
  tabTextActive: {
    color: "#020617",
  },
  helperText: {
    fontSize: 12,
    color: "#94a3b8",
    lineHeight: 17,
    marginBottom: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#cbd5e1",
    marginBottom: 6,
    marginTop: 8,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 6,
  },
  input: {
    flex: 1,
    color: "#f8fafc",
    fontSize: 14,
  },
  primaryButton: {
    backgroundColor: "#eab308",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 14,
    shadowColor: "#eab308",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: "#020617",
    fontSize: 14,
    fontWeight: "800",
  },
  linkButton: {
    marginTop: 12,
    alignItems: "center",
    paddingVertical: 6,
  },
  linkButtonText: {
    color: "#94a3b8",
    fontSize: 12,
    textDecorationLine: "underline",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.4)",
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  errorText: {
    color: "#fca5a5",
    fontSize: 12,
    flex: 1,
  },
  successBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(34, 197, 94, 0.4)",
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  successText: {
    color: "#86efac",
    fontSize: 12,
    flex: 1,
  },
  sentContainer: {
    alignItems: "center",
    paddingVertical: 12,
  },
  successIconBubble: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  sentTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#f8fafc",
    marginBottom: 8,
  },
  sentDescription: {
    fontSize: 13,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 14,
  },
});
