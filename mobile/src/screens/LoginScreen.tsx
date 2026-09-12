import React, { useState, useEffect } from "react";
import {
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
  Mail,
  Lock,
  Users,
  Eye,
  EyeOff,
  Sparkles,
  Zap,
  Trophy,
  ShieldCheck,
  KeyRound,
  AlertCircle,
} from "lucide-react-native";
import {
  loginWithEmail,
  registerWithEmail,
  fetchAppSettings,
  acceptTerms,
  signOutUser,
} from "../services/authService";
import { AppSettings, AppUser } from "../types";
import LoginPasswordModal from "../components/LoginPasswordModal";
import TermsModal from "../components/TermsModal";

const APP_VERSION = "v1.0.53";

interface LoginScreenProps {
  onSuccess?: () => void;
}

export default function LoginScreen({ onSuccess }: LoginScreenProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [groupCode, setGroupCode] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Settings & Terms
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [pendingTermsUser, setPendingTermsUser] = useState<AppUser | null>(null);
  const [isAcceptingTerms, setIsAcceptingTerms] = useState(false);

  // Password recovery / change modal
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  useEffect(() => {
    fetchAppSettings().then((settings) => {
      setAppSettings(settings);
    });
  }, []);

  const handleSubmit = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password;
    const trimmedGroupCode = groupCode.trim().toUpperCase();

    if (!trimmedEmail || !trimmedPassword) {
      setError("Preencha seu e-mail e sua senha.");
      return;
    }

    if (isRegister && !name.trim()) {
      setError("Informe seu nome ou apelido para o cadastro.");
      return;
    }

    if (trimmedPassword.length < 6) {
      setError("A senha deve conter no mínimo 6 caracteres.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let resultUser: AppUser;
      if (isRegister) {
        const { profile } = await registerWithEmail(
          trimmedEmail,
          trimmedPassword,
          name.trim(),
          trimmedGroupCode || undefined
        );
        resultUser = profile;
      } else {
        const { profile } = await loginWithEmail(
          trimmedEmail,
          trimmedPassword,
          trimmedGroupCode || undefined
        );
        resultUser = profile;
      }

      // Check terms of use acceptance
      const requiredVersion = appSettings?.termsOfUseVersion ?? 1;
      const userVersion = resultUser.acceptedTermsVersion ?? 0;
      if (resultUser.termsAccepted !== true || userVersion < requiredVersion) {
        setPendingTermsUser(resultUser);
      } else {
        onSuccess?.();
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      if (
        err.code === "auth/invalid-credential" ||
        err.code === "auth/wrong-password"
      ) {
        setError("E-mail ou senha incorretos.");
      } else if (err.code === "auth/user-not-found") {
        setError("Nenhuma conta encontrada com este e-mail.");
      } else if (err.code === "auth/email-already-in-use") {
        setError("Este e-mail já está cadastrado. Mude para a aba 'Entrar'.");
      } else if (err.code === "auth/invalid-email") {
        setError("Formato de e-mail inválido.");
      } else if (err.code === "auth/weak-password") {
        setError("A senha escolhida é muito fraca. Use ao menos 6 caracteres.");
      } else if (err.code === "auth/too-many-requests") {
        setError("Muitas tentativas sem sucesso. Aguarde alguns instantes.");
      } else {
        setError(err.message || "Erro ao autenticar. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptTerms = async () => {
    if (!pendingTermsUser) return;
    setIsAcceptingTerms(true);
    try {
      const version = appSettings?.termsOfUseVersion ?? 1;
      await acceptTerms(pendingTermsUser.uid, version);
      setPendingTermsUser(null);
      onSuccess?.();
    } catch (err: any) {
      console.error(err);
      throw err;
    } finally {
      setIsAcceptingTerms(false);
    }
  };

  const handleDeclineTerms = async () => {
    setPendingTermsUser(null);
    await signOutUser();
  };

  const cooldown = appSettings?.cooldownMinutes ?? 15;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Top Feature Badge */}
        <View style={styles.badgeContainer}>
          <View style={styles.badge}>
            <Sparkles size={14} color="#eab308" style={{ marginRight: 6 }} />
            <Text style={styles.badgeText}>Competição Corporativa</Text>
          </View>
        </View>

        {/* Header Branding */}
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoIcon}>🚽</Text>
          </View>
          <Text style={styles.title}>PrivadIn</Text>
          <Text style={styles.subtitle}>
            O app definitivo da cagada remunerada
          </Text>
        </View>

        {/* Feature Highlights Cards */}
        <View style={styles.featuresRow}>
          <View style={styles.featureCard}>
            <Zap size={16} color="#eab308" style={{ marginBottom: 4 }} />
            <Text style={styles.featureTitle}>Tempo Real</Text>
            <Text style={styles.featureSub}>Ganhos por segundo</Text>
          </View>

          <View style={styles.featureCard}>
            <Trophy size={16} color="#eab308" style={{ marginBottom: 4 }} />
            <Text style={styles.featureTitle}>Ranking</Text>
            <Text style={styles.featureSub}>Dispute a liderança</Text>
          </View>

          <View style={styles.featureCard}>
            <ShieldCheck size={16} color="#eab308" style={{ marginBottom: 4 }} />
            <Text style={styles.featureTitle}>Antifraude</Text>
            <Text style={styles.featureSub}>{cooldown} min cooldown</Text>
          </View>
        </View>

        {/* Main Card */}
        <View style={styles.card}>
          {/* Tab Switcher */}
          <View style={styles.tabSwitch}>
            <TouchableOpacity
              style={[styles.tabButton, !isRegister && styles.tabButtonActive]}
              onPress={() => {
                setIsRegister(false);
                setError(null);
              }}
            >
              <Text style={[styles.tabText, !isRegister && styles.tabTextActive]}>
                Entrar
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabButton, isRegister && styles.tabButtonActive]}
              onPress={() => {
                setIsRegister(true);
                setError(null);
              }}
            >
              <Text style={[styles.tabText, isRegister && styles.tabTextActive]}>
                Cadastrar
              </Text>
            </TouchableOpacity>
          </View>

          {/* Error box */}
          {error && (
            <View style={styles.errorBox}>
              <AlertCircle size={16} color="#fca5a5" style={{ marginRight: 6 }} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Registration Name Field */}
          {isRegister && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nome ou Apelido</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Ex: Mestre do Trono"
                  placeholderTextColor="#64748b"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
              </View>
            </View>
          )}

          {/* Email Field */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>E-mail</Text>
            <View style={styles.inputContainer}>
              <Mail size={18} color="#eab308" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="seu@empresa.com"
                placeholderTextColor="#64748b"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Password Field */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Senha</Text>
            <View style={styles.inputContainer}>
              <Lock size={18} color="#eab308" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor="#64748b"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
              >
                {showPassword ? (
                  <EyeOff size={18} color="#94a3b8" />
                ) : (
                  <Eye size={18} color="#94a3b8" />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Forgot or change password link */}
          <View style={styles.forgotPasswordRow}>
            <TouchableOpacity
              onPress={() => setShowPasswordModal(true)}
              style={styles.forgotPasswordButton}
            >
              <KeyRound size={13} color="#eab308" style={{ marginRight: 4 }} />
              <Text style={styles.forgotPasswordText}>
                Esqueceu ou deseja alterar a senha?
              </Text>
            </TouchableOpacity>
          </View>

          {/* Group Code (Optional) */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Código do grupo</Text>
              <Text style={styles.optionalBadge}>Opcional</Text>
            </View>
            <View style={styles.inputContainer}>
              <Users size={18} color="#eab308" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, styles.monoInput]}
                placeholder="Ex: ABCD1234"
                placeholderTextColor="#64748b"
                value={groupCode}
                onChangeText={(text) => setGroupCode(text.trim().toUpperCase())}
                autoCapitalize="characters"
                maxLength={32}
              />
            </View>
            <Text style={styles.groupHint}>
              Se você recebeu um código da sua equipe, você já entra nela ao criar a conta.
            </Text>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#020617" />
            ) : (
              <Text style={styles.submitButtonText}>
                {isRegister ? "Criar Conta e Começar" : "Acessar o Trono"}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Footer info */}
        <View style={styles.footerContainer}>
          <Text style={styles.footerSecurity}>
            🔒 Seus dados e cagadas permanecem confidenciais.
          </Text>
          <Text style={styles.footerVersion}>{APP_VERSION}</Text>
        </View>
      </ScrollView>

      {/* Password Reset / Direct Change Modal */}
      <LoginPasswordModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        initialEmail={email}
        onPasswordChanged={(changedEmail) => {
          setEmail(changedEmail);
          setPassword("");
        }}
      />

      {/* Terms of Use Modal */}
      <TermsModal
        isOpen={Boolean(pendingTermsUser)}
        termsText={appSettings?.termsOfUseText}
        termsVersion={appSettings?.termsOfUseVersion ?? 1}
        onAccept={handleAcceptTerms}
        onDecline={handleDeclineTerms}
        loading={isAcceptingTerms}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#020617",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  badgeContainer: {
    alignItems: "center",
    marginBottom: 12,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(234, 179, 8, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.3)",
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  badgeText: {
    color: "#eab308",
    fontSize: 12,
    fontWeight: "700",
  },
  header: {
    alignItems: "center",
    marginBottom: 18,
  },
  logoCircle: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: "#eab308",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#eab308",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
    marginBottom: 12,
  },
  logoIcon: {
    fontSize: 42,
  },
  title: {
    fontSize: 34,
    fontWeight: "900",
    color: "#f8fafc",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: "#94a3b8",
    marginTop: 4,
    textAlign: "center",
    fontWeight: "500",
  },
  featuresRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 20,
  },
  featureCard: {
    flex: 1,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 14,
    padding: 10,
    alignItems: "center",
  },
  featureTitle: {
    color: "#f8fafc",
    fontSize: 11,
    fontWeight: "800",
  },
  featureSub: {
    color: "#64748b",
    fontSize: 10,
    marginTop: 2,
    textAlign: "center",
  },
  card: {
    backgroundColor: "#0f172a",
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: "#1e293b",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 6,
  },
  tabSwitch: {
    flexDirection: "row",
    backgroundColor: "#1e293b",
    borderRadius: 14,
    padding: 4,
    marginBottom: 18,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: "#334155",
  },
  tabText: {
    color: "#94a3b8",
    fontWeight: "700",
    fontSize: 13,
  },
  tabTextActive: {
    color: "#f8fafc",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.4)",
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  errorText: {
    color: "#fca5a5",
    fontSize: 13,
    flex: 1,
  },
  inputGroup: {
    marginBottom: 14,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  label: {
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
  },
  optionalBadge: {
    fontSize: 10,
    color: "#64748b",
    fontWeight: "600",
    backgroundColor: "#1e293b",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: "#f8fafc",
    fontSize: 14,
  },
  monoInput: {
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    letterSpacing: 1.5,
    fontWeight: "700",
  },
  eyeButton: {
    padding: 4,
  },
  forgotPasswordRow: {
    alignItems: "flex-end",
    marginTop: -4,
    marginBottom: 14,
  },
  forgotPasswordButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
  },
  forgotPasswordText: {
    color: "#eab308",
    fontSize: 12,
    fontWeight: "700",
  },
  groupHint: {
    color: "#64748b",
    fontSize: 11,
    marginTop: 4,
    lineHeight: 15,
  },
  submitButton: {
    backgroundColor: "#eab308",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
    shadowColor: "#eab308",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: "#020617",
    fontSize: 15,
    fontWeight: "900",
  },
  footerContainer: {
    alignItems: "center",
    marginTop: 22,
    gap: 4,
  },
  footerSecurity: {
    color: "#64748b",
    fontSize: 11,
    textAlign: "center",
  },
  footerVersion: {
    color: "#475569",
    fontSize: 11,
    fontWeight: "600",
  },
});
