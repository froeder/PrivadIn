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
  Globe,
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
import {
  translations,
  SupportedLanguage,
  getPersistedLanguage,
  persistLanguage,
} from "../utils/i18n";

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
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Settings & Terms
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [pendingTermsUser, setPendingTermsUser] = useState<AppUser | null>(null);
  const [isAcceptingTerms, setIsAcceptingTerms] = useState(false);
  const [showTermsReadModal, setShowTermsReadModal] = useState(false);

  // Language state
  const [language, setLanguage] = useState<SupportedLanguage>("pt-BR");
  const t = translations[language];

  // Password recovery / change modal
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  useEffect(() => {
    getPersistedLanguage().then(setLanguage);
    fetchAppSettings().then((settings) => {
      setAppSettings(settings);
    });
  }, []);

  const toggleLanguage = () => {
    const next: SupportedLanguage = language === "pt-BR" ? "en-US" : "pt-BR";
    setLanguage(next);
    persistLanguage(next);
  };

  const handleSubmit = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password;
    const trimmedGroupCode = groupCode.trim().toUpperCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!trimmedEmail || !trimmedPassword) {
      setError(t.errFillFields);
      return;
    }

    if (!emailRegex.test(trimmedEmail)) {
      setError(t.errEmailInvalid);
      return;
    }

    if (isRegister) {
      if (!name.trim()) {
        setError(t.errNameRequired);
        return;
      }

      if (name.trim().length < 3) {
        setError(t.errNameMin);
        return;
      }

      if (name.trim().length > 30) {
        setError(t.errNameMax);
        return;
      }

      if (!termsAccepted) {
        setError(t.errMustAcceptTerms);
        return;
      }
    }

    if (trimmedPassword.length < 6) {
      setError(t.errPasswordMin);
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
          trimmedGroupCode || undefined,
          appSettings?.termsOfUseVersion ?? 1
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
        setError(t.errWrongCredentials);
      } else if (err.code === "auth/user-not-found") {
        setError(t.errUserNotFound);
      } else if (err.code === "auth/email-already-in-use") {
        setError(t.errEmailInUse);
      } else if (err.code === "auth/invalid-email") {
        setError(t.errEmailInvalid);
      } else if (err.code === "auth/weak-password") {
        setError(t.errWeakPassword);
      } else if (err.code === "auth/too-many-requests") {
        setError(t.errTooManyRequests);
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
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Top Feature Badge & Language Switcher */}
        <View style={styles.topBarRow}>
          <View style={styles.badge}>
            <Sparkles size={14} color="#eab308" style={{ marginRight: 6 }} />
            <Text style={styles.badgeText}>{t.badge}</Text>
          </View>

          {/* Language Switcher */}
          <TouchableOpacity
            style={styles.langSwitchBtn}
            onPress={toggleLanguage}
            activeOpacity={0.7}
          >
            <Globe size={13} color="#eab308" style={{ marginRight: 4 }} />
            <Text style={styles.langSwitchText}>
              {language === "pt-BR" ? "🇧🇷 PT" : "🇺🇸 EN"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Header Branding */}
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoIcon}>🚽</Text>
          </View>
          <Text style={styles.title}>{t.title}</Text>
          <Text style={styles.subtitle}>{t.subtitle}</Text>
        </View>

        {/* Feature Highlights Cards */}
        <View style={styles.featuresRow}>
          <View style={styles.featureCard}>
            <Zap size={16} color="#eab308" style={{ marginBottom: 4 }} />
            <Text style={styles.featureTitle}>{t.featureRealtime}</Text>
            <Text style={styles.featureSub}>{t.featureRealtimeSub}</Text>
          </View>

          <View style={styles.featureCard}>
            <Trophy size={16} color="#eab308" style={{ marginBottom: 4 }} />
            <Text style={styles.featureTitle}>{t.featureRanking}</Text>
            <Text style={styles.featureSub}>{t.featureRankingSub}</Text>
          </View>

          <View style={styles.featureCard}>
            <ShieldCheck size={16} color="#eab308" style={{ marginBottom: 4 }} />
            <Text style={styles.featureTitle}>{t.featureAntifraud}</Text>
            <Text style={styles.featureSub}>
              {cooldown} min {t.featureAntifraudSub}
            </Text>
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
                {t.tabSignIn}
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
                {t.tabRegister}
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
              <Text style={styles.label}>{t.labelName}</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder={t.placeholderName}
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
            <Text style={styles.label}>{t.labelEmail}</Text>
            <View style={styles.inputContainer}>
              <Mail size={18} color="#eab308" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder={t.placeholderEmail}
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
            <Text style={styles.label}>{t.labelPassword}</Text>
            <View style={styles.inputContainer}>
              <Lock size={18} color="#eab308" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder={t.placeholderPassword}
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
          {!isRegister && (
            <View style={styles.forgotPasswordRow}>
              <TouchableOpacity
                onPress={() => setShowPasswordModal(true)}
                style={styles.forgotPasswordButton}
              >
                <KeyRound size={13} color="#eab308" style={{ marginRight: 4 }} />
                <Text style={styles.forgotPasswordText}>{t.forgotPassword}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Group Code (Optional) */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>{t.labelGroupCode}</Text>
              <Text style={styles.optionalBadge}>{t.badgeOptional}</Text>
            </View>
            <View style={styles.inputContainer}>
              <Users size={18} color="#eab308" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, styles.monoInput]}
                placeholder={t.placeholderGroupCode}
                placeholderTextColor="#64748b"
                value={groupCode}
                onChangeText={(text) => setGroupCode(text.trim().toUpperCase())}
                autoCapitalize="characters"
                maxLength={32}
              />
            </View>
            <Text style={styles.groupHint}>{t.groupCodeHint}</Text>
          </View>

          {/* Terms of use checkbox during registration */}
          {isRegister && (
            <View style={styles.termsCheckboxContainer}>
              <TouchableOpacity
                style={[
                  styles.termsCheckbox,
                  termsAccepted && styles.termsCheckboxChecked,
                ]}
                onPress={() => setTermsAccepted(!termsAccepted)}
                activeOpacity={0.8}
              >
                {termsAccepted && <Text style={styles.termsCheckmark}>✓</Text>}
              </TouchableOpacity>
              <View style={styles.termsTextWrapper}>
                <Text style={styles.termsMainText}>
                  {t.termsLabel}{" "}
                  <Text
                    style={styles.termsLinkText}
                    onPress={() => setShowTermsReadModal(true)}
                  >
                    {t.termsLink} (v{appSettings?.termsOfUseVersion ?? 1})
                  </Text>
                </Text>
              </View>
            </View>
          )}

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
                {isRegister ? t.btnRegister : t.btnSignIn}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Footer info */}
        <View style={styles.footerContainer}>
          <Text style={styles.footerSecurity}>{t.footerSecurity}</Text>
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
        isOpen={showTermsReadModal || Boolean(pendingTermsUser)}
        termsText={appSettings?.termsOfUseText}
        termsVersion={appSettings?.termsOfUseVersion ?? 1}
        onAccept={async () => {
          if (pendingTermsUser) {
            await handleAcceptTerms();
          } else {
            setTermsAccepted(true);
            setShowTermsReadModal(false);
          }
        }}
        onDecline={async () => {
          if (pendingTermsUser) {
            await handleDeclineTerms();
          } else {
            setShowTermsReadModal(false);
          }
        }}
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
  topBarRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  langSwitchBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(30, 41, 59, 0.8)",
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.3)",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 16,
  },
  langSwitchText: {
    color: "#eab308",
    fontSize: 12,
    fontWeight: "bold",
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
  termsCheckboxContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 4,
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  termsCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#475569",
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  termsCheckboxChecked: {
    backgroundColor: "#eab308",
    borderColor: "#eab308",
  },
  termsCheckmark: {
    color: "#0f172a",
    fontSize: 12,
    fontWeight: "900",
  },
  termsTextWrapper: {
    flex: 1,
  },
  termsMainText: {
    fontSize: 12,
    color: "#94a3b8",
    lineHeight: 18,
  },
  termsLinkText: {
    color: "#eab308",
    fontWeight: "700",
    textDecorationLine: "underline",
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
