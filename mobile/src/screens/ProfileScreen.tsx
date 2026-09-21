import React, { useState, useMemo, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  Modal,
  Linking,
  Platform,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppUser, WorkSchedule } from "../types";
import { signOutUser, deleteCurrentUserAccount } from "../services/authService";
import {
  updateUserProfileCustomization,
  updateUserWorkSchedule,
  updateUserFinancialSettings,
  uploadUserAvatarPhoto,
} from "../services/poopService";
import PoopcoinWalletCard from "../components/PoopcoinWalletCard";
import TransferPoopcoinsModal from "../components/TransferPoopcoinsModal";
import UserProfileModal from "../components/UserProfileModal";
import UserAvatar from "../components/UserAvatar";
import ChangePasswordModal from "../components/ChangePasswordModal";
import AvatarCropper from "../components/AvatarCropper";
import * as ImagePicker from "expo-image-picker";
import {
  SupportedLanguage,
  getPersistedLanguage,
  persistLanguage,
} from "../utils/i18n";
import { IS_DEV, FIRESTORE_DATABASE_ID } from "../services/firebase";

interface ProfileScreenProps {
  user: AppUser;
  onRefreshUser: () => void;
  onNavigateToPoopcoins?: () => void;
  onNavigateToAnalytics?: () => void;
  onNavigateToAdmin?: () => void;
}

const AVATAR_PRESETS = [
  "🚽", "💩", "👑", "🚀", "💎", "🦄", "⚡", "🕶️",
  "🎮", "🦁", "🧻", "💰", "☕", "🔥", "🐱", "🐶",
];

const THEME_PALETTES = [
  { id: "gold", label: "Ouro", color: "#eab308", border: "#facc15" },
  { id: "cyan", label: "Ciano", color: "#06b6d4", border: "#22d3ee" },
  { id: "purple", label: "Púrpura", color: "#a855f7", border: "#c084fc" },
  { id: "emerald", label: "Esmeralda", color: "#10b981", border: "#34d399" },
  { id: "orange", label: "Brasa", color: "#f97316", border: "#fb923c" },
  { id: "pink", label: "Neon", color: "#ec4899", border: "#f472b6" },
  { id: "blue", label: "Corporativo", color: "#3b82f6", border: "#60a5fa" },
];

const TIMEZONE_OPTIONS = [
  { id: "America/Sao_Paulo", label: "Brasília (UTC-3)" },
  { id: "America/Manaus", label: "Manaus (UTC-4)" },
  { id: "America/Cuiaba", label: "Cuiabá (UTC-4)" },
  { id: "America/Belem", label: "Belém (UTC-3)" },
  { id: "America/Noronha", label: "Noronha (UTC-2)" },
  { id: "UTC", label: "UTC (Global)" },
];

function parseCurrencyInput(value: string): number {
  const cleaned = value.replace(/[^\d.,]/g, "").trim();
  if (!cleaned) return NaN;

  if (cleaned.includes(".") && cleaned.includes(",")) {
    if (cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")) {
      return parseFloat(cleaned.replace(/\./g, "").replace(",", "."));
    } else {
      return parseFloat(cleaned.replace(/,/g, ""));
    }
  }

  if (cleaned.includes(",")) {
    return parseFloat(cleaned.replace(",", "."));
  }

  const parts = cleaned.split(".");
  if (parts.length === 2 && parts[1].length === 3 && parseFloat(parts[0]) >= 1) {
    return parseFloat(cleaned.replace(/\./g, ""));
  }

  return parseFloat(cleaned);
}

function timeToMinutes(timeStr: string): number {
  if (!timeStr || !timeStr.includes(":")) return 0;
  const [h, m] = timeStr.split(":").map((n) => parseInt(n, 10) || 0);
  return h * 60 + m;
}

export default function ProfileScreen({
  user,
  onRefreshUser,
  onNavigateToPoopcoins,
  onNavigateToAnalytics,
  onNavigateToAdmin,
}: ProfileScreenProps) {
  // Navigation / Modal States
  const [publicProfileModalVisible, setPublicProfileModalVisible] = useState(false);
  const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [changePasswordModalVisible, setChangePasswordModalVisible] = useState(false);
  const [copiedSelfUid, setCopiedSelfUid] = useState(false);

  // Active section tab in screen
  const [activeSection, setActiveSection] = useState<"profile" | "work" | "financial" | "security">("profile");

  // Account Deletion States (Google Play & LGPD Compliance)
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // 1. Profile customization state
  const [nickname, setNickname] = useState(user.nickname || user.name || "");
  const [bio, setBio] = useState(user.bio || "");
  const [selectedAvatar, setSelectedAvatar] = useState(user.avatar || "🚿");
  const [customAvatarInput, setCustomAvatarInput] = useState("");
  const [selectedTheme, setSelectedTheme] = useState(user.themeColor || "#eab308");
  const [savingProfile, setSavingProfile] = useState(false);

  // Photo avatar state
  const [photoUri, setPhotoUri] = useState<string | null>(
    user.avatar?.startsWith("http") ? user.avatar : null
  );
  const [cropperVisible, setCropperVisible] = useState(false);
  const [pendingPhotoUri, setPendingPhotoUri] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Preferences: Idioma e Tema de Aparência
  const [language, setLanguage] = useState<SupportedLanguage>("pt-BR");
  const [appearanceTheme, setAppearanceTheme] = useState<"dark" | "light" | "system">("dark");

  // 2. Work Schedule & Bathroom state
  const [workStart, setWorkStart] = useState(
    user.workSchedule?.horarioInicioExpediente || "09:00"
  );
  const [workEnd, setWorkEnd] = useState(
    user.workSchedule?.horarioFimExpediente || "18:00"
  );
  const [lunchStart, setLunchStart] = useState(
    user.workSchedule?.horarioInicioAlmoco || "12:00"
  );
  const [lunchEnd, setLunchEnd] = useState(
    user.workSchedule?.horarioFimAlmoco || "13:00"
  );
  const [timezone, setTimezone] = useState(
    user.workSchedule?.timezone || "America/Sao_Paulo"
  );
  const [bathroomDurationInput, setBathroomDurationInput] = useState(
    user.bathroomDurationMinutes ? String(user.bathroomDurationMinutes) : "10"
  );
  const [savingWork, setSavingWork] = useState(false);

  // Carregar preferências persistidas (idioma e tema)
  useEffect(() => {
    async function loadPreferences() {
      const savedLang = await getPersistedLanguage();
      setLanguage(savedLang);
      try {
        const savedAppearance = await AsyncStorage.getItem("@privadin:appearance_theme");
        if (savedAppearance === "dark" || savedAppearance === "light" || savedAppearance === "system") {
          setAppearanceTheme(savedAppearance);
        }
      } catch (err) {
        console.warn("Error loading appearance theme:", err);
      }
    }
    loadPreferences();
  }, []);

  useEffect(() => {
    if (user.bathroomDurationMinutes) {
      setBathroomDurationInput(String(user.bathroomDurationMinutes));
    }
  }, [user.bathroomDurationMinutes]);

  // Sync photoUri when user.avatar changes externally (e.g. after onRefreshUser)
  useEffect(() => {
    if (user.avatar?.startsWith("http")) {
      setPhotoUri(user.avatar);
    } else {
      setPhotoUri(null);
    }
  }, [user.avatar]);

  // Handler: Copiar Própria Chave Poopcoin / UID
  const handleCopySelfUid = async () => {
    try {
      await Clipboard.setStringAsync(user.uid);
      setCopiedSelfUid(true);
      setTimeout(() => setCopiedSelfUid(false), 2500);
      Alert.alert(
        "Chave Poopcoin / ID Copiado! 📋",
        "Seu identificador único foi copiado para a área de transferência. Envie para colegas para receber transferências de Poopcoins."
      );
    } catch {
      Alert.alert("Erro", "Não foi possível copiar o ID.");
    }
  };

  // Handler: Alterar Idioma
  const handleChangeLanguage = async (newLang: SupportedLanguage) => {
    setLanguage(newLang);
    await persistLanguage(newLang);
    Alert.alert(
      newLang === "pt-BR" ? "Idioma Atualizado 🇧🇷" : "Language Updated 🇺🇸",
      newLang === "pt-BR"
        ? "O idioma foi definido para Português (Brasil)."
        : "Language set to English (US)."
    );
  };

  // Handler: Alterar Modo de Tema
  const handleChangeAppearance = async (newTheme: "dark" | "light" | "system") => {
    setAppearanceTheme(newTheme);
    try {
      await AsyncStorage.setItem("@privadin:appearance_theme", newTheme);
      Alert.alert(
        "Aparência Atualizada 🎨",
        `Tema configurado para: ${
          newTheme === "dark"
            ? "Escuro (Noturno OLED)"
            : newTheme === "light"
              ? "Claro"
              : "Acompanhar Sistema"
        }`
      );
    } catch (err) {
      console.warn("Error saving appearance theme:", err);
    }
  };

  // 3. Financial Settings state
  const [financialMode, setFinancialMode] = useState<"salary" | "hourly">("salary");
  const [salaryInput, setSalaryInput] = useState(
    user.salary ? String(user.salary) : "3000"
  );
  const [hourlyInput, setHourlyInput] = useState(
    user.hourlyRate ? String(user.hourlyRate.toFixed(2)) : "17.05"
  );
  const [savingFinancial, setSavingFinancial] = useState(false);

  // Calculate monthly working hours based on schedule
  const monthlyWorkHours = useMemo(() => {
    const totalDayMin = timeToMinutes(workEnd) - timeToMinutes(workStart);
    const lunchMin = Math.max(0, timeToMinutes(lunchEnd) - timeToMinutes(lunchStart));
    const netDayHours = Math.max(1, (totalDayMin - lunchMin) / 60);
    // Typical 22 working days
    return Math.round(netDayHours * 22) || 176;
  }, [workStart, workEnd, lunchStart, lunchEnd]);

  // Live calculated financial values
  const effectiveCalculations = useMemo(() => {
    if (financialMode === "salary") {
      const sal = parseCurrencyInput(salaryInput);
      if (isNaN(sal) || sal <= 0) return { salary: 0, hourly: 0, perMinute: 0 };
      const hourly = sal / monthlyWorkHours;
      return { salary: sal, hourly, perMinute: hourly / 60 };
    } else {
      const hr = parseCurrencyInput(hourlyInput);
      if (isNaN(hr) || hr <= 0) return { salary: 0, hourly: 0, perMinute: 0 };
      const sal = hr * monthlyWorkHours;
      return { salary: sal, hourly: hr, perMinute: hr / 60 };
    }
  }, [financialMode, salaryInput, hourlyInput, monthlyWorkHours]);

  // Handler: Pick photo from gallery or camera
  const handlePickPhoto = async (source: "gallery" | "camera") => {
    const permResult =
      source === "gallery"
        ? await ImagePicker.requestMediaLibraryPermissionsAsync()
        : await ImagePicker.requestCameraPermissionsAsync();

    if (!permResult.granted) {
      Alert.alert(
        "Permissão necessária",
        source === "gallery"
          ? "Permita o acesso à galeria nas configurações do dispositivo."
          : "Permita o acesso à câmera nas configurações do dispositivo."
      );
      return;
    }

    const result =
      source === "gallery"
        ? await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsEditing: false,
            quality: 0.7,
            maxWidth: 1024,
            maxHeight: 1024,
          })
        : await ImagePicker.launchCameraAsync({
            allowsEditing: false,
            quality: 0.7,
            maxWidth: 1024,
            maxHeight: 1024,
          });

    if (!result.canceled && result.assets[0]) {
      setPendingPhotoUri(result.assets[0].uri);
      setCropperVisible(true);
    }
  };

  // Handler: Apply cropped photo (upload to Firebase Storage)
  const handleApplyCrop = async (cropData: {
    zoom: number;
    offsetX: number;
    offsetY: number;
    imageUrl: string;
  }) => {
    if (!cropData.imageUrl) return;
    setUploadingPhoto(true);
    try {
      console.log("[Avatar] Iniciando upload para URI:", cropData.imageUrl);
      const url = await uploadUserAvatarPhoto(user.uid, cropData.imageUrl);
      console.log("[Avatar] Upload OK, URL:", url);
      // Adiciona cache-buster para forçar o React Native a não usar a imagem antiga em cache
      const cacheBustedUrl = `${url}&_t=${Date.now()}`;
      setPhotoUri(cacheBustedUrl);
      setCustomAvatarInput("");
      setCropperVisible(false);
      setPendingPhotoUri(null);
      onRefreshUser();
      Alert.alert("📸 Foto Atualizada!", "Sua foto de perfil foi salva com sucesso.");
    } catch (err: any) {
      console.error("[Avatar] Erro ao fazer upload da foto:", err);
      Alert.alert(
        "Erro ao salvar foto",
        `Não foi possível salvar a foto.\n\nDetalhe: ${err?.message ?? String(err)}\n\nVerifique sua conexão e tente novamente.`
      );
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Handler: Remove photo (revert to emoji)
  const handleRemovePhoto = () => {
    Alert.alert(
      "Remover Foto",
      "Deseja remover sua foto de perfil e voltar ao avatar emoji?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Remover",
          style: "destructive",
          onPress: async () => {
            try {
              await updateUserProfileCustomization(user.uid, { avatar: selectedAvatar });
              setPhotoUri(null);
              onRefreshUser();
            } catch {
              Alert.alert("Erro", "Não foi possível remover a foto.");
            }
          },
        },
      ]
    );
  };

  // Handler: Save Profile Customization
  const handleSaveProfile = async () => {
    if (!nickname.trim()) {
      Alert.alert("Aviso", "Por favor, insira um apelido ou nome de guerra.");
      return;
    }

    setSavingProfile(true);
    try {
      // Se tiver foto, ela já foi salva no upload. Salva nickname/theme/bio + avatar.
      const finalAvatar = photoUri ?? (customAvatarInput.trim() || selectedAvatar);
      await updateUserProfileCustomization(user.uid, {
        nickname: nickname.trim(),
        avatar: finalAvatar,
        themeColor: selectedTheme,
        bio: bio.trim(),
      });
      Alert.alert("Perfil Atualizado! 🎨", "Seu apelido, avatar e tema foram salvos.");
      onRefreshUser();
    } catch (error: any) {
      console.error("Erro ao salvar perfil:", error);
      Alert.alert("Erro", "Não foi possível salvar os dados do perfil.");
    } finally {
      setSavingProfile(false);
    }
  };

  // Handler: Save Work Schedule & Bathroom Duration
  const handleSaveWorkSchedule = async () => {
    setSavingWork(true);
    try {
      const schedule: WorkSchedule = {
        horarioInicioExpediente: workStart.trim() || "09:00",
        horarioFimExpediente: workEnd.trim() || "18:00",
        horarioInicioAlmoco: lunchStart.trim() || "12:00",
        horarioFimAlmoco: lunchEnd.trim() || "13:00",
        timezone,
      };

      const duration = parseInt(bathroomDurationInput, 10);
      const finalDuration = isNaN(duration) || duration < 1 ? 10 : Math.min(180, duration);

      await updateUserWorkSchedule(user.uid, schedule, finalDuration);
      Alert.alert(
        "Jornada Salva! ⏰",
        `Seus horários de expediente, fuso horário e tempo médio no banheiro (${finalDuration} min) foram atualizados.`
      );
      onRefreshUser();
    } catch (error: any) {
      console.error("Erro ao salvar jornada:", error);
      Alert.alert("Erro", "Não foi possível salvar a jornada de trabalho.");
    } finally {
      setSavingWork(false);
    }
  };

  // Preset Applicator
  const applySchedulePreset = (start: string, end: string, lStart: string, lEnd: string) => {
    setWorkStart(start);
    setWorkEnd(end);
    setLunchStart(lStart);
    setLunchEnd(lEnd);
  };

  // Handler: Save Financial Settings
  const handleSaveFinancials = async () => {
    const { salary, hourly } = effectiveCalculations;
    if (salary <= 0 || hourly <= 0) {
      Alert.alert("Erro", "Por favor, insira um valor monetário válido.");
      return;
    }

    setSavingFinancial(true);
    try {
      await updateUserFinancialSettings(user.uid, {
        salary: Number(salary.toFixed(2)),
        hourlyRate: Number(hourly.toFixed(2)),
      });
      Alert.alert(
        "Finanças Atualizadas! 💰",
        `Salário: R$ ${salary.toFixed(2).replace(".", ",")} | Valor/Hora: R$ ${hourly.toFixed(2).replace(".", ",")}`
      );
      onRefreshUser();
    } catch (error: any) {
      console.error("Erro ao salvar configurações financeiras:", error);
      Alert.alert("Erro", "Não foi possível salvar os parâmetros financeiros.");
    } finally {
      setSavingFinancial(false);
    }
  };

  // Logout
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

  // Exclusão de Conta (Google Play Store Policy & LGPD)
  const handleDeleteAccount = async () => {
    if (deleteConfirmText.trim().toUpperCase() !== "EXCLUIR") {
      Alert.alert(
        "Confirmação Necessária",
        "Por favor, digite a palavra EXCLUIR para confirmar a eliminação de todos os seus dados."
      );
      return;
    }

    setIsDeletingAccount(true);
    try {
      await deleteCurrentUserAccount(deletePassword ? deletePassword.trim() : undefined);
      setDeleteModalVisible(false);
      Alert.alert(
        "Conta Excluída",
        "Sua conta e todos os dados foram eliminados definitivamente do PrivadIn, em conformidade com as diretrizes do Google Play e da LGPD."
      );
    } catch (err: any) {
      console.error("Erro ao excluir conta:", err);
      Alert.alert(
        "Erro na Exclusão",
        err.message || "Não foi possível excluir a conta. Verifique sua senha e tente novamente."
      );
    } finally {
      setIsDeletingAccount(false);
    }
  };

  const userThemeColor = user.themeColor || selectedTheme || "#eab308";
  const userHourlyRate = user.hourlyRate || (user.salary ? user.salary / 176 : 20);

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      {/* Profile Header Card */}
      <View style={styles.profileHeader}>
        <UserAvatar
          avatar={photoUri ?? user.avatar ?? selectedAvatar}
          badge={user.equippedBadge}
          name={user.nickname || user.name}
          size={84}
          borderColor={userThemeColor}
          borderWidth={3}
          backgroundColor="#1e293b"
          textColor={userThemeColor}
          fontSize={38}
        />

        <Text style={styles.userName}>{user.nickname || user.name || "Cagador Anônimo"}</Text>
        <Text style={styles.userEmail}>{user.email}</Text>

        {user.equippedTitle && (
          <TouchableOpacity
            style={[styles.profileTitleBadge, { borderColor: `${userThemeColor}60` }]}
            onPress={onNavigateToPoopcoins}
            activeOpacity={0.7}
          >
            <Text style={[styles.profileTitleText, { color: userThemeColor }]}>
              👑 {user.equippedTitle}
            </Text>
          </TouchableOpacity>
        )}

        {/* Public Profile Preview Button */}
        <TouchableOpacity
          style={[styles.publicProfileButton, { borderColor: `${userThemeColor}80` }]}
          onPress={() => setPublicProfileModalVisible(true)}
          activeOpacity={0.8}
        >
          <Text style={{ fontSize: 16 }}>👁️</Text>
          <Text style={[styles.publicProfileButtonText, { color: userThemeColor }]}>
            Ver Como os Colegas Me Veem
          </Text>
        </TouchableOpacity>

        {/* Copy Own UID / Poopcoin Key Button */}
        <TouchableOpacity
          style={[styles.copyIdPill, { borderColor: `${userThemeColor}40` }]}
          onPress={handleCopySelfUid}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 13 }}>📋</Text>
          <Text style={styles.copyIdPillText}>
            {copiedSelfUid
              ? "Chave Copiada! ✓"
              : `Chave: ${user.uid ? `${user.uid.slice(0, 10)}...` : ""} (Toque p/ Copiar)`}
          </Text>
        </TouchableOpacity>

        {/* 🛡️ Admin Master Portal Banner (Only for role="admin") */}
        {user.role === "admin" && (
          <TouchableOpacity
            style={styles.adminAccessCard}
            onPress={onNavigateToAdmin}
            activeOpacity={0.85}
          >
            <View style={styles.adminAccessHeader}>
              <View style={styles.adminBadgePill}>
                <Text style={styles.adminBadgePillText}>👑 ACESSO MASTER</Text>
              </View>
              <Text style={styles.adminAccessArrow}>Abrir Painel →</Text>
            </View>
            <Text style={styles.adminAccessTitle}>🛡️ Painel do Administrador</Text>
            <Text style={styles.adminAccessDesc}>
              Gestão de usuários (banir/promover), regras de pontuação, reset semanal e auditoria.
            </Text>
          </TouchableOpacity>
        )}

        {/* 🏷️ Environment Badge (Dev/Prod Indicator) */}
        <View style={[
          styles.envBadge,
          IS_DEV ? styles.envBadgeDev : styles.envBadgeProd,
        ]}>
          <Text style={styles.envBadgeDot}>{IS_DEV ? "🟡" : "🟢"}</Text>
          <View>
            <Text style={[
              styles.envBadgeLabel,
              { color: IS_DEV ? "#fbbf24" : "#4ade80" },
            ]}>
              {IS_DEV ? "HOMOLOGAÇÃO" : "PRODUÇÃO"}
            </Text>
            <Text style={styles.envBadgeDb}>
              Banco: {FIRESTORE_DATABASE_ID}
            </Text>
          </View>
        </View>
      </View>

      {/* Navigation Sub-Tabs */}
      <View style={styles.sectionTabs}>
        <TouchableOpacity
          style={[
            styles.sectionTabButton,
            activeSection === "profile" && [styles.sectionTabButtonActive, { borderColor: userThemeColor }],
          ]}
          onPress={() => setActiveSection("profile")}
        >
          <Text style={{ fontSize: 15 }}>🎨</Text>
          <Text
            style={[
              styles.sectionTabText,
              activeSection === "profile" && { color: userThemeColor, fontWeight: "800" },
            ]}
          >
            Perfil
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.sectionTabButton,
            activeSection === "work" && [styles.sectionTabButtonActive, { borderColor: userThemeColor }],
          ]}
          onPress={() => setActiveSection("work")}
        >
          <Text style={{ fontSize: 15 }}>⏰</Text>
          <Text
            style={[
              styles.sectionTabText,
              activeSection === "work" && { color: userThemeColor, fontWeight: "800" },
            ]}
          >
            Jornada
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.sectionTabButton,
            activeSection === "financial" && [styles.sectionTabButtonActive, { borderColor: userThemeColor }],
          ]}
          onPress={() => setActiveSection("financial")}
        >
          <Text style={{ fontSize: 15 }}>💰</Text>
          <Text
            style={[
              styles.sectionTabText,
              activeSection === "financial" && { color: userThemeColor, fontWeight: "800" },
            ]}
          >
            Finanças
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.sectionTabButton,
            activeSection === "security" && [styles.sectionTabButtonActive, { borderColor: userThemeColor }],
          ]}
          onPress={() => setActiveSection("security")}
        >
          <Text style={{ fontSize: 15 }}>🔒</Text>
          <Text
            style={[
              styles.sectionTabText,
              activeSection === "security" && { color: userThemeColor, fontWeight: "800" },
            ]}
          >
            Segurança
          </Text>
        </TouchableOpacity>
      </View>

      {/* SECTION 1: PROFILE & VISUAL CUSTOMIZATION */}
      {activeSection === "profile" && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Edição do Perfil Visual</Text>
          <Text style={styles.cardDescription}>
            Personalize seu apelido de guerra, avatar temático e a cor de destaque do seu perfil.
          </Text>

          {/* Nickname Input */}
          <Text style={styles.inputLabel}>Apelido / Nome de Guerra</Text>
          <TextInput
            style={styles.textInput}
            value={nickname}
            onChangeText={setNickname}
            placeholder="Ex: Mestre do Trono"
            placeholderTextColor="#64748b"
            maxLength={28}
          />

          {/* Bio Input */}
          <Text style={[styles.inputLabel, { marginTop: 14 }]}>Biografia / Frase de Efeito</Text>
          <TextInput
            style={[styles.textInput, { height: 72, textAlignVertical: "top" }]}
            value={bio}
            onChangeText={setBio}
            placeholder="Ex: Trabalhando duro, faturando sentado."
            placeholderTextColor="#64748b"
            multiline
            numberOfLines={3}
            maxLength={120}
          />

          {/* Photo Avatar Picker */}
          <Text style={[styles.inputLabel, { marginTop: 0, marginBottom: 10 }]}>Foto de Perfil</Text>

          {/* Current photo preview */}
          {photoUri ? (
            <View style={styles.photoPreviewRow}>
              <UserAvatar
                avatar={photoUri}
                name={user.nickname || user.name}
                size={72}
                borderColor={userThemeColor}
                borderWidth={2.5}
                backgroundColor="#1e293b"
              />
              <View style={styles.photoPreviewActions}>
                <TouchableOpacity
                  style={[styles.photoActionBtn, { borderColor: userThemeColor }]}
                  onPress={() => handlePickPhoto("gallery")}
                  activeOpacity={0.8}
                >
                  <Text style={styles.photoActionIcon}>🖼️</Text>
                  <Text style={[styles.photoActionText, { color: userThemeColor }]}>Trocar Foto</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.photoActionBtn, { borderColor: "#ef4444" }]}
                  onPress={handleRemovePhoto}
                  activeOpacity={0.8}
                >
                  <Text style={styles.photoActionIcon}>🗑️</Text>
                  <Text style={[styles.photoActionText, { color: "#ef4444" }]}>Remover Foto</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.photoPickerRow}>
              <TouchableOpacity
                style={[styles.photoPickBtn, { borderColor: `${userThemeColor}60` }]}
                onPress={() => handlePickPhoto("gallery")}
                activeOpacity={0.8}
              >
                <Text style={styles.photoPickIcon}>🖼️</Text>
                <Text style={styles.photoPickLabel}>Galeria</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.photoPickBtn, { borderColor: `${userThemeColor}60` }]}
                onPress={() => handlePickPhoto("camera")}
                activeOpacity={0.8}
              >
                <Text style={styles.photoPickIcon}>📷</Text>
                <Text style={styles.photoPickLabel}>Câmera</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Avatar Emoji Picker — shown when no photo */}
          {!photoUri && (
            <>
              <View style={styles.avatarPhotoSeparator}>
                <View style={styles.separatorLine} />
                <Text style={styles.separatorText}>ou escolha um emoji</Text>
                <View style={styles.separatorLine} />
              </View>

              {/* Avatar Picker */}
              <Text style={[styles.inputLabel, { marginTop: 16 }]}>Escolha seu Avatar</Text>
              <View style={styles.avatarGrid}>
                {AVATAR_PRESETS.map((emoji) => {
                  const isSelected = selectedAvatar === emoji && !customAvatarInput.trim();
                  return (
                    <TouchableOpacity
                      key={emoji}
                      style={[
                        styles.avatarPresetItem,
                        isSelected && [styles.avatarPresetSelected, { borderColor: selectedTheme }],
                      ]}
                      onPress={() => {
                        setSelectedAvatar(emoji);
                        setCustomAvatarInput("");
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={{ fontSize: 24 }}>{emoji}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Custom Avatar Input */}
              <View style={styles.customAvatarRow}>
                <Text style={styles.customAvatarHint}>Ou digite outro emoji:</Text>
                <TextInput
                  style={styles.customAvatarInput}
                  value={customAvatarInput}
                  onChangeText={(txt) => {
                    setCustomAvatarInput(txt);
                    if (txt.trim()) setSelectedAvatar(txt.trim());
                  }}
                  placeholder="Ex: 🐯"
                  placeholderTextColor="#64748b"
                  maxLength={4}
                />
              </View>
            </>
          )}

          {/* Theme Color Selector */}
          <Text style={[styles.inputLabel, { marginTop: 16 }]}>Cor de Destaque do Aplicativo</Text>
          <View style={styles.themePaletteRow}>
            {THEME_PALETTES.map((palette) => {
              const isSelected = selectedTheme === palette.color;
              return (
                <TouchableOpacity
                  key={palette.id}
                  style={[
                    styles.themeColorCircle,
                    { backgroundColor: palette.color },
                    isSelected && styles.themeColorSelected,
                  ]}
                  onPress={() => setSelectedTheme(palette.color)}
                  activeOpacity={0.7}
                >
                  {isSelected && <Text style={styles.themeCheckmark}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Preferências: Idioma & Modo de Tema */}
          <View style={styles.preferencesDivider} />
          <Text style={styles.subSectionTitle}>Preferências do Aplicativo</Text>
          <Text style={styles.cardDescription}>
            Configure o idioma e o modo de exibição da interface do PrivadIn.
          </Text>

          {/* Idioma */}
          <Text style={styles.inputLabel}>Idioma / Language</Text>
          <View style={styles.prefButtonsRow}>
            <TouchableOpacity
              style={[
                styles.prefButton,
                language === "pt-BR" && [
                  styles.prefButtonActive,
                  { borderColor: selectedTheme, backgroundColor: `${selectedTheme}15` },
                ],
              ]}
              onPress={() => handleChangeLanguage("pt-BR")}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 16 }}>🇧🇷</Text>
              <Text
                style={[
                  styles.prefButtonText,
                  language === "pt-BR" && { color: selectedTheme, fontWeight: "800" },
                ]}
              >
                Português
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.prefButton,
                language === "en-US" && [
                  styles.prefButtonActive,
                  { borderColor: selectedTheme, backgroundColor: `${selectedTheme}15` },
                ],
              ]}
              onPress={() => handleChangeLanguage("en-US")}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 16 }}>🇺🇸</Text>
              <Text
                style={[
                  styles.prefButtonText,
                  language === "en-US" && { color: selectedTheme, fontWeight: "800" },
                ]}
              >
                English
              </Text>
            </TouchableOpacity>
          </View>

          {/* Modo de Aparência (Tema) */}
          <Text style={[styles.inputLabel, { marginTop: 14 }]}>Modo de Aparência</Text>
          <View style={styles.prefButtonsRow}>
            <TouchableOpacity
              style={[
                styles.prefButton,
                appearanceTheme === "dark" && [
                  styles.prefButtonActive,
                  { borderColor: selectedTheme, backgroundColor: `${selectedTheme}15` },
                ],
              ]}
              onPress={() => handleChangeAppearance("dark")}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 15 }}>🌙</Text>
              <Text
                style={[
                  styles.prefButtonText,
                  appearanceTheme === "dark" && { color: selectedTheme, fontWeight: "800" },
                ]}
              >
                Escuro
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.prefButton,
                appearanceTheme === "light" && [
                  styles.prefButtonActive,
                  { borderColor: selectedTheme, backgroundColor: `${selectedTheme}15` },
                ],
              ]}
              onPress={() => handleChangeAppearance("light")}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 15 }}>☀️</Text>
              <Text
                style={[
                  styles.prefButtonText,
                  appearanceTheme === "light" && { color: selectedTheme, fontWeight: "800" },
                ]}
              >
                Claro
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.prefButton,
                appearanceTheme === "system" && [
                  styles.prefButtonActive,
                  { borderColor: selectedTheme, backgroundColor: `${selectedTheme}15` },
                ],
              ]}
              onPress={() => handleChangeAppearance("system")}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 15 }}>⚙️</Text>
              <Text
                style={[
                  styles.prefButtonText,
                  appearanceTheme === "system" && { color: selectedTheme, fontWeight: "800" },
                ]}
              >
                Sistema
              </Text>
            </TouchableOpacity>
          </View>

          {/* Save Profile Button */}
          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: selectedTheme }]}
            onPress={handleSaveProfile}
            disabled={savingProfile}
          >
            {savingProfile ? (
              <ActivityIndicator color="#020617" />
            ) : (
              <Text style={styles.saveButtonText}>Salvar Identidade</Text>
            )}
          </TouchableOpacity>

          {/* AvatarCropper Modal */}
          <AvatarCropper
            isOpen={cropperVisible}
            imageUrl={pendingPhotoUri || ""}
            onApply={handleApplyCrop}
            onCancel={() => {
              setCropperVisible(false);
              setPendingPhotoUri(null);
            }}
          />

          {/* Upload overlay */}
          {uploadingPhoto && (
            <View style={styles.uploadOverlay}>
              <ActivityIndicator size="large" color={userThemeColor} />
              <Text style={[styles.uploadOverlayText, { color: userThemeColor }]}>
                Enviando foto...
              </Text>
            </View>
          )}
        </View>
      )}

      {/* SECTION 2: WORK SCHEDULE & TIMEZONE */}
      {activeSection === "work" && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Configuração da Jornada de Trabalho</Text>
          <Text style={styles.cardDescription}>
            Defina seu expediente e intervalos para calibrar suas horas úteis diárias e mensais.
          </Text>

          {/* Quick Presets */}
          <Text style={styles.inputLabel}>Modelos Prontos de Expediente</Text>
          <View style={styles.presetsContainer}>
            <TouchableOpacity
              style={styles.presetChip}
              onPress={() => applySchedulePreset("09:00", "18:00", "12:00", "13:00")}
            >
              <Text style={styles.presetChipText}>Comercial 09h - 18h</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.presetChip}
              onPress={() => applySchedulePreset("08:00", "17:00", "12:00", "13:00")}
            >
              <Text style={styles.presetChipText}>Turno Cedo 08h - 17h</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.presetChip}
              onPress={() => applySchedulePreset("10:00", "19:00", "13:00", "14:00")}
            >
              <Text style={styles.presetChipText}>Flexível / Dev 10h - 19h</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.presetChip}
              onPress={() => applySchedulePreset("07:00", "13:00", "10:00", "10:15")}
            >
              <Text style={styles.presetChipText}>Plantão 6 Horas</Text>
            </TouchableOpacity>
          </View>

          {/* Schedule Inputs */}
          <View style={styles.timeInputsRow}>
            <View style={styles.timeInputCol}>
              <Text style={styles.inputLabel}>Entrada</Text>
              <TextInput
                style={styles.timeTextInput}
                value={workStart}
                onChangeText={setWorkStart}
                placeholder="09:00"
                placeholderTextColor="#64748b"
                maxLength={5}
              />
            </View>

            <View style={styles.timeInputCol}>
              <Text style={styles.inputLabel}>Saída</Text>
              <TextInput
                style={styles.timeTextInput}
                value={workEnd}
                onChangeText={setWorkEnd}
                placeholder="18:00"
                placeholderTextColor="#64748b"
                maxLength={5}
              />
            </View>
          </View>

          <View style={[styles.timeInputsRow, { marginTop: 12 }]}>
            <View style={styles.timeInputCol}>
              <Text style={styles.inputLabel}>Início Almoço</Text>
              <TextInput
                style={styles.timeTextInput}
                value={lunchStart}
                onChangeText={setLunchStart}
                placeholder="12:00"
                placeholderTextColor="#64748b"
                maxLength={5}
              />
            </View>

            <View style={styles.timeInputCol}>
              <Text style={styles.inputLabel}>Fim Almoço</Text>
              <TextInput
                style={styles.timeTextInput}
                value={lunchEnd}
                onChangeText={setLunchEnd}
                placeholder="13:00"
                placeholderTextColor="#64748b"
                maxLength={5}
              />
            </View>
          </View>

          {/* Timezone Selector */}
          <Text style={[styles.inputLabel, { marginTop: 16 }]}>Fuso Horário Oficial</Text>
          <View style={styles.timezoneList}>
            {TIMEZONE_OPTIONS.map((tz) => {
              const isSelected = timezone === tz.id;
              return (
                <TouchableOpacity
                  key={tz.id}
                  style={[
                    styles.timezoneChip,
                    isSelected && [styles.timezoneChipSelected, { borderColor: userThemeColor }],
                  ]}
                  onPress={() => setTimezone(tz.id)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.timezoneChipText,
                      isSelected && { color: userThemeColor, fontWeight: "800" },
                    ]}
                  >
                    {tz.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Tempo Médio de Banheiro / Duração Padrão */}
          <Text style={[styles.inputLabel, { marginTop: 18 }]}>
            Tempo Médio no Trono / Duração Padrão (Minutos)
          </Text>
          <Text style={styles.cardDescription}>
            Define a duração média estimada das suas sessões para calibrar alertas de saúde e cálculos de lucratividade.
          </Text>

          {/* Quick Presets for Duration */}
          <View style={styles.presetsContainer}>
            {[5, 10, 15, 20, 30].map((mins) => {
              const isSelected = bathroomDurationInput === String(mins);
              return (
                <TouchableOpacity
                  key={mins}
                  style={[
                    styles.presetChip,
                    isSelected && [styles.presetChipSelected, { borderColor: userThemeColor }],
                  ]}
                  onPress={() => setBathroomDurationInput(String(mins))}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.presetChipText,
                      isSelected && { color: userThemeColor, fontWeight: "800" },
                    ]}
                  >
                    {mins} min {mins === 10 ? "⭐" : ""}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={{ marginTop: 8 }}>
            <TextInput
              style={styles.timeTextInput}
              value={bathroomDurationInput}
              onChangeText={setBathroomDurationInput}
              placeholder="10"
              placeholderTextColor="#64748b"
              keyboardType="numeric"
              maxLength={3}
            />
            <Text style={[styles.customAvatarHint, { marginTop: 4 }]}>
              * Valor permitido: entre 1 e 180 minutos. Padrão: 10 minutos.
            </Text>
          </View>

          {/* Work Calculation Summary Banner */}
          <View style={styles.scheduleSummaryBox}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>HORAS / DIA</Text>
              <Text style={styles.summaryValue}>
                {((timeToMinutes(workEnd) - timeToMinutes(workStart) - (timeToMinutes(lunchEnd) - timeToMinutes(lunchStart))) / 60).toFixed(1)}h
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>HORAS / MÊS</Text>
              <Text style={styles.summaryValue}>{monthlyWorkHours}h</Text>
            </View>
          </View>

          {/* Save Work Button */}
          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: userThemeColor }]}
            onPress={handleSaveWorkSchedule}
            disabled={savingWork}
          >
            {savingWork ? (
              <ActivityIndicator color="#020617" />
            ) : (
              <Text style={styles.saveButtonText}>Salvar Jornada de Trabalho</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* SECTION 3: FINANCIAL SETTINGS */}
      {activeSection === "financial" && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Configuração Financeira</Text>
          <Text style={styles.cardDescription}>
            Escolha se prefere definir seu salário mensal ou o valor da sua hora. Calculamos exatamente quanto você ganha a cada minuto no banheiro.
          </Text>

          {/* Financial Mode Switcher */}
          <View style={styles.financialModeRow}>
            <TouchableOpacity
              style={[
                styles.financialModeBtn,
                financialMode === "salary" && [
                  styles.financialModeBtnActive,
                  { borderColor: userThemeColor, backgroundColor: `${userThemeColor}15` },
                ],
              ]}
              onPress={() => setFinancialMode("salary")}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 16 }}>💵</Text>
              <Text
                style={[
                  styles.financialModeBtnText,
                  financialMode === "salary" && { color: userThemeColor, fontWeight: "800" },
                ]}
              >
                Salário Mensal
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.financialModeBtn,
                financialMode === "hourly" && [
                  styles.financialModeBtnActive,
                  { borderColor: userThemeColor, backgroundColor: `${userThemeColor}15` },
                ],
              ]}
              onPress={() => setFinancialMode("hourly")}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 16 }}>⏱️</Text>
              <Text
                style={[
                  styles.financialModeBtnText,
                  financialMode === "hourly" && { color: userThemeColor, fontWeight: "800" },
                ]}
              >
                Valor da Hora
              </Text>
            </TouchableOpacity>
          </View>

          {/* Input Based on Selected Mode */}
          {financialMode === "salary" ? (
            <View>
              <Text style={styles.inputLabel}>Salário Mensal Bruto / Líquido (R$)</Text>
              <View style={styles.inputRow}>
                <View style={styles.currencyPrefix}>
                  <Text style={styles.currencyText}>R$</Text>
                </View>
                <TextInput
                  style={styles.salaryInput}
                  value={salaryInput}
                  onChangeText={setSalaryInput}
                  keyboardType="numeric"
                  placeholder="3000,00"
                  placeholderTextColor="#64748b"
                />
              </View>
            </View>
          ) : (
            <View>
              <Text style={styles.inputLabel}>Valor da Sua Hora de Trabalho (R$/hora)</Text>
              <View style={styles.inputRow}>
                <View style={styles.currencyPrefix}>
                  <Text style={styles.currencyText}>R$</Text>
                </View>
                <TextInput
                  style={styles.salaryInput}
                  value={hourlyInput}
                  onChangeText={setHourlyInput}
                  keyboardType="numeric"
                  placeholder="25,00"
                  placeholderTextColor="#64748b"
                />
              </View>
            </View>
          )}

          {/* Real-time Earnings Simulation Card */}
          <View style={styles.earningsSimulationCard}>
            <Text style={styles.earningsSimTitle}>Simulador de Ganhos no Trono 🚽</Text>

            <View style={styles.earningsGrid}>
              <View style={styles.earningsGridItem}>
                <Text style={styles.earningsGridLabel}>POR HORA</Text>
                <Text style={styles.earningsGridValue}>
                  R$ {effectiveCalculations.hourly.toFixed(2).replace(".", ",")}
                </Text>
              </View>

              <View style={styles.earningsGridItem}>
                <Text style={styles.earningsGridLabel}>POR MINUTO</Text>
                <Text style={[styles.earningsGridValue, { color: "#10b981" }]}>
                  R$ {effectiveCalculations.perMinute.toFixed(2).replace(".", ",")}
                </Text>
              </View>

              <View style={styles.earningsGridItem}>
                <Text style={styles.earningsGridLabel}>SESSÃO 10 MIN</Text>
                <Text style={styles.earningsGridValue}>
                  R$ {(effectiveCalculations.perMinute * 10).toFixed(2).replace(".", ",")}
                </Text>
              </View>

              <View style={styles.earningsGridItem}>
                <Text style={styles.earningsGridLabel}>SESSÃO 15 MIN</Text>
                <Text style={styles.earningsGridValue}>
                  R$ {(effectiveCalculations.perMinute * 15).toFixed(2).replace(".", ",")}
                </Text>
              </View>
            </View>

            <Text style={styles.earningsSimNote}>
              * Cálculo baseado em {monthlyWorkHours} horas mensais configuradas na sua jornada.
            </Text>
          </View>

          {/* Save Financials Button */}
          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: userThemeColor }]}
            onPress={handleSaveFinancials}
            disabled={savingFinancial}
          >
            {savingFinancial ? (
              <ActivityIndicator color="#020617" />
            ) : (
              <Text style={styles.saveButtonText}>Salvar Parâmetros Financeiros</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* SECTION 4: SECURITY, PRIVACY & ACCOUNT DELETION */}
      {activeSection === "security" && (
        <View style={styles.card}>
          <View style={styles.complianceBadge}>
            <Text style={styles.complianceBadgeText}>🛡️ GOOGLE PLAY & LGPD COMPLIANCE</Text>
          </View>

          <Text style={styles.cardTitle}>Segurança & Exclusão de Conta</Text>
          <Text style={styles.cardDescription}>
            Gerencie a proteção da sua conta, consulte o tratamento de dados e solicite a exclusão definitiva ou parcial conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).
          </Text>

          {/* Account Details Box */}
          <View style={styles.accountInfoBox}>
            <View style={styles.accountInfoRow}>
              <Text style={styles.accountInfoLabel}>E-mail Cadastrado:</Text>
              <Text style={styles.accountInfoValue}>{user.email}</Text>
            </View>
            <View style={styles.accountInfoRow}>
              <Text style={styles.accountInfoLabel}>ID do Usuário:</Text>
              <Text style={styles.accountInfoValue} numberOfLines={1}>
                {user.uid}
              </Text>
            </View>
            <View style={styles.accountInfoRow}>
              <Text style={styles.accountInfoLabel}>Termos de Uso:</Text>
              <Text style={[styles.accountInfoValue, { color: "#4ade80" }]}>
                {user.termsAccepted ? "Aceito" : "Pendente"}
              </Text>
            </View>
          </View>

          {/* Troca de Senha Autenticada */}
          <View style={styles.changePasswordCard}>
            <View style={styles.changePasswordHeader}>
              <Text style={styles.changePasswordTitle}>🔐 Alteração de Senha de Acesso</Text>
              <Text style={styles.changePasswordDesc}>
                Mantenha sua conta protegida. Você pode alterar sua senha a qualquer momento com validação imediata ou receber um link de redefinição por e-mail.
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.changePasswordButton, { backgroundColor: userThemeColor }]}
              onPress={() => setChangePasswordModalVisible(true)}
              activeOpacity={0.85}
            >
              <Text style={styles.changePasswordButtonText}>Alterar Senha Agora</Text>
            </TouchableOpacity>
          </View>

          {/* Exclusão Parcial de Dados (conforme política oficial) */}
          <View style={styles.partialDeletionCard}>
            <Text style={styles.partialDeletionTitle}>⚙️ Exclusão Parcial de Dados</Text>
            <Text style={styles.partialDeletionText}>
              Você pode remover sessões antigas ou corrigir seus registros sem precisar fechar sua conta. Para gerenciar ou excluir registros específicos do histórico, acesse o painel de histórico.
            </Text>
            {onNavigateToAnalytics && (
              <TouchableOpacity
                style={styles.partialActionBtn}
                onPress={onNavigateToAnalytics}
              >
                <Text style={styles.partialActionBtnText}>Gerenciar Histórico de Sessões 📜</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Política Oficial Link */}
          <TouchableOpacity
            style={styles.policyLinkButton}
            onPress={() =>
              Linking.openURL("https://froeder.github.io/privadin-exclusao.html").catch(() => {
                Alert.alert(
                  "Link da Política",
                  "Acesse https://froeder.github.io/privadin-exclusao.html no seu navegador."
                );
              })
            }
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.policyLinkTitle}>📄 Página Oficial de Exclusão de Dados</Text>
              <Text style={styles.policyLinkSubtitle}>froeder.github.io/privadin-exclusao.html</Text>
            </View>
            <Text style={styles.policyLinkArrow}>↗</Text>
          </TouchableOpacity>

          {/* DPO / Contact info */}
          <View style={styles.dpoContactBox}>
            <Text style={styles.dpoContactTitle}>📧 Canal do Encarregado de Dados (DPO)</Text>
            <Text style={styles.dpoContactText}>
              Dúvidas ou solicitações manuais:{" "}
              <Text
                style={{ color: "#38bdf8", textDecorationLine: "underline" }}
                onPress={() => Linking.openURL("mailto:froeder3@gmail.com")}
              >
                froeder3@gmail.com
              </Text>
            </Text>
          </View>

          {/* ZONA DE PERIGO: Exclusão Total da Conta */}
          <View style={styles.dangerZoneCard}>
            <View style={styles.dangerZoneHeader}>
              <Text style={styles.dangerZoneTitle}>⚠️ Zona de Perigo: Exclusão Permanente</Text>
            </View>
            <Text style={styles.dangerZoneText}>
              A exclusão total da conta é irreversível. Todos os dados serão permanentemente deletados: perfil, sessões, pontos, saldo de PoopCoins e postagens no Cuiter. Caso deseje utilizar o PrivadIn futuramente, você precisará realizar um novo cadastro.
            </Text>

            <TouchableOpacity
              style={styles.deleteAccountButton}
              onPress={() => {
                setDeletePassword("");
                setDeleteConfirmText("");
                setDeleteModalVisible(true);
              }}
            >
              <Text style={styles.deleteAccountButtonText}>
                🗑️ Excluir Minha Conta e Meus Dados
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Career Stats Grid Card */}
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
            <Text style={styles.gridValue}>{user.poopcoinBalance || 0} 🪙</Text>
            <Text style={styles.gridLabel}>Poopcoins</Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.gridValue}>R$ {userHourlyRate.toFixed(2)}</Text>
            <Text style={styles.gridLabel}>Por Hora</Text>
          </View>
        </View>

        {onNavigateToAnalytics && (
          <TouchableOpacity
            style={styles.analyticsButton}
            onPress={onNavigateToAnalytics}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ fontSize: 16 }}>📊</Text>
              <Text style={{ color: "#f8fafc", fontSize: 12, fontWeight: "800" }}>
                Ver Analytics Completo & Gráficos
              </Text>
            </View>
            <Text style={{ color: userThemeColor, fontSize: 14, fontWeight: "900" }}>›</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Poopcoin Wallet Card */}
      <PoopcoinWalletCard
        user={user}
        onOpenTransfer={() => setTransferModalVisible(true)}
        onViewLedger={onNavigateToPoopcoins}
      />

      {/* App Info & Logout */}
      <View style={styles.footerSection}>
        <Text style={styles.versionText}>PrivadIn Mobile v1.0.0 • Expo EAS</Text>

        <TouchableOpacity
          style={styles.manageAccountButton}
          onPress={() => setActiveSection("security")}
          activeOpacity={0.7}
        >
          <Text style={styles.manageAccountButtonText}>
            🛡️ Segurança, Privacidade & Exclusão de Conta
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} onPress={handleSignOut}>
          <Text style={styles.logoutText}>Encerrar Sessão</Text>
        </TouchableOpacity>
      </View>

      {/* Public Profile Modal Preview */}
      <UserProfileModal
        visible={publicProfileModalVisible}
        userId={user.uid}
        currentUserId={user.uid}
        onClose={() => setPublicProfileModalVisible(false)}
      />

      {/* Transfer Modal */}
      <TransferPoopcoinsModal
        visible={transferModalVisible}
        currentUser={user}
        onClose={() => setTransferModalVisible(false)}
        onSuccess={onRefreshUser}
      />

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={changePasswordModalVisible}
        onClose={() => setChangePasswordModalVisible(false)}
        userEmail={user.email}
        themeColor={userThemeColor}
      />

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO DE CONTA */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !isDeletingAccount && setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { borderColor: "rgba(239, 68, 68, 0.4)" }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: "#ef4444" }]}>
                  ⚠️ Excluir Conta Definitivamente
                </Text>
                <Text style={styles.modalSubtitle}>
                  Esta ação é permanente e irreversível.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => !isDeletingAccount && setDeleteModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Text style={styles.modalCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
              <View style={styles.deleteWarningBox}>
                <Text style={styles.deleteWarningText}>
                  Todos os seguintes dados serão excluídos permanentemente:
                </Text>
                <Text style={styles.deleteWarningBullet}>• Seu perfil ({user.name || user.email})</Text>
                <Text style={styles.deleteWarningBullet}>• Todos os registros de sessões e pontos</Text>
                <Text style={styles.deleteWarningBullet}>• Postagens e reações no Cuiter</Text>
                <Text style={styles.deleteWarningBullet}>• Participação e vínculos em grupos/ligas</Text>
                <Text style={styles.deleteWarningBullet}>• Login no Firebase Authentication</Text>
              </View>

              {/* Password confirmation */}
              <Text style={[styles.inputLabel, { marginTop: 12 }]}>
                Confirme sua senha de acesso:
              </Text>
              <TextInput
                style={styles.textInput}
                placeholder="Sua senha atual"
                placeholderTextColor="#64748b"
                secureTextEntry
                value={deletePassword}
                onChangeText={setDeletePassword}
              />

              {/* Confirmation text input */}
              <Text style={[styles.inputLabel, { marginTop: 14 }]}>
                Para confirmar, digite <Text style={{ color: "#ef4444", fontWeight: "900" }}>EXCLUIR</Text> abaixo:
              </Text>
              <TextInput
                style={[
                  styles.textInput,
                  {
                    borderColor:
                      deleteConfirmText.trim().toUpperCase() === "EXCLUIR" ? "#ef4444" : "#334155",
                  },
                ]}
                placeholder="Digite EXCLUIR"
                placeholderTextColor="#64748b"
                value={deleteConfirmText}
                onChangeText={setDeleteConfirmText}
                autoCapitalize="characters"
              />
            </ScrollView>

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setDeleteModalVisible(false)}
                disabled={isDeletingAccount}
              >
                <Text style={styles.modalCancelBtnText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalConfirmDeleteBtn,
                  (deleteConfirmText.trim().toUpperCase() !== "EXCLUIR" || isDeletingAccount) && {
                    opacity: 0.5,
                  },
                ]}
                onPress={handleDeleteAccount}
                disabled={
                  deleteConfirmText.trim().toUpperCase() !== "EXCLUIR" || isDeletingAccount
                }
              >
                {isDeletingAccount ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.modalConfirmDeleteBtnText}>Excluir Tudo</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    marginBottom: 20,
    marginTop: 6,
  },
  userName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#f8fafc",
    marginTop: 10,
  },
  userEmail: {
    fontSize: 13,
    color: "#94a3b8",
    marginTop: 2,
  },
  profileTitleBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
    marginTop: 8,
  },
  profileTitleText: {
    fontSize: 12,
    fontWeight: "800",
  },
  publicProfileButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    marginTop: 12,
  },
  publicProfileButtonText: {
    fontSize: 12,
    fontWeight: "800",
  },
  sectionTabs: {
    flexDirection: "row",
    backgroundColor: "#0f172a",
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  sectionTabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "transparent",
  },
  sectionTabButtonActive: {
    backgroundColor: "#1e293b",
  },
  sectionTabText: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: "600",
  },
  card: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 20,
    padding: 18,
    marginBottom: 18,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#f8fafc",
    marginBottom: 6,
  },
  cardDescription: {
    fontSize: 13,
    color: "#94a3b8",
    marginBottom: 16,
    lineHeight: 18,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#cbd5e1",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  textInput: {
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "600",
  },
  avatarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  avatarPresetItem: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarPresetSelected: {
    borderWidth: 2,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  customAvatarRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1e293b",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 4,
    borderWidth: 1,
    borderColor: "#334155",
  },
  customAvatarHint: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: "600",
  },
  customAvatarInput: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#475569",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    color: "#f8fafc",
    fontSize: 16,
    width: 60,
    textAlign: "center",
  },
  themePaletteRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 16,
    marginTop: 4,
  },
  themeColorCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  themeColorSelected: {
    borderWidth: 3,
    borderColor: "#ffffff",
    transform: [{ scale: 1.1 }],
  },
  themeCheckmark: {
    color: "#020617",
    fontSize: 16,
    fontWeight: "900",
  },
  presetsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  presetChip: {
    backgroundColor: "#1e293b",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#334155",
  },
  presetChipSelected: {
    borderWidth: 1.5,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  presetChipText: {
    color: "#cbd5e1",
    fontSize: 11,
    fontWeight: "700",
  },
  timeInputsRow: {
    flexDirection: "row",
    gap: 12,
  },
  timeInputCol: {
    flex: 1,
  },
  timeTextInput: {
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: "#f8fafc",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
  timezoneList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  timezoneChip: {
    backgroundColor: "#1e293b",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#334155",
  },
  timezoneChipSelected: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  timezoneChipText: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "600",
  },
  scheduleSummaryBox: {
    flexDirection: "row",
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 12,
    marginVertical: 14,
    borderWidth: 1,
    borderColor: "#334155",
    alignItems: "center",
    justifyContent: "space-around",
  },
  summaryItem: {
    alignItems: "center",
  },
  summaryLabel: {
    fontSize: 10,
    color: "#94a3b8",
    fontWeight: "700",
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: "900",
    color: "#f8fafc",
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 28,
    backgroundColor: "#334155",
  },
  financialModeRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  financialModeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 12,
    paddingVertical: 12,
  },
  financialModeBtnActive: {
    borderWidth: 1.5,
  },
  financialModeBtnText: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: "700",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
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
  earningsSimulationCard: {
    backgroundColor: "#1e293b",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#334155",
  },
  earningsSimTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#f8fafc",
    marginBottom: 10,
  },
  earningsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  earningsGridItem: {
    width: "48%",
    backgroundColor: "#0f172a",
    borderRadius: 10,
    padding: 10,
  },
  earningsGridLabel: {
    fontSize: 9,
    color: "#94a3b8",
    fontWeight: "700",
  },
  earningsGridValue: {
    fontSize: 14,
    fontWeight: "800",
    color: "#f8fafc",
    marginTop: 2,
  },
  earningsSimNote: {
    fontSize: 10,
    color: "#64748b",
    marginTop: 8,
    fontStyle: "italic",
  },
  saveButton: {
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 4,
  },
  saveButtonText: {
    color: "#020617",
    fontWeight: "800",
    fontSize: 14,
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
  analyticsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#1e293b",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 14,
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.25)",
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
  adminAccessCard: {
    width: "100%",
    backgroundColor: "#0f172a",
    borderRadius: 16,
    padding: 14,
    marginTop: 14,
    borderWidth: 1.5,
    borderColor: "#eab308",
    shadowColor: "#eab308",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  adminAccessHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  adminBadgePill: {
    backgroundColor: "#eab30822",
    borderWidth: 1,
    borderColor: "#eab308",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  adminBadgePillText: {
    color: "#eab308",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  adminAccessArrow: {
    color: "#eab308",
    fontSize: 12,
    fontWeight: "bold",
  },
  adminAccessTitle: {
    color: "#f8fafc",
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 4,
  },
  adminAccessDesc: {
    color: "#94a3b8",
    fontSize: 12,
    lineHeight: 16,
  },

  // Security & Compliance Section Styles
  complianceBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 10,
  },
  complianceBadgeText: {
    color: "#34d399",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  accountInfoBox: {
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 12,
    padding: 14,
    marginTop: 14,
    gap: 8,
  },
  accountInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  accountInfoLabel: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "600",
  },
  accountInfoValue: {
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "800",
    maxWidth: "60%",
  },
  partialDeletionCard: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 14,
    marginTop: 14,
    borderLeftWidth: 3,
    borderLeftColor: "#38bdf8",
  },
  partialDeletionTitle: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 4,
  },
  partialDeletionText: {
    color: "#94a3b8",
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 10,
  },
  partialActionBtn: {
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#334155",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  partialActionBtnText: {
    color: "#38bdf8",
    fontSize: 11,
    fontWeight: "800",
  },
  policyLinkButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 12,
    padding: 14,
    marginTop: 14,
  },
  policyLinkTitle: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "800",
  },
  policyLinkSubtitle: {
    color: "#64748b",
    fontSize: 11,
    marginTop: 2,
  },
  policyLinkArrow: {
    color: "#eab308",
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 10,
  },
  dpoContactBox: {
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
  },
  dpoContactTitle: {
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 4,
  },
  dpoContactText: {
    color: "#94a3b8",
    fontSize: 11,
    lineHeight: 16,
  },
  dangerZoneCard: {
    backgroundColor: "rgba(239, 68, 68, 0.06)",
    borderWidth: 1.5,
    borderColor: "rgba(239, 68, 68, 0.4)",
    borderRadius: 16,
    padding: 16,
    marginTop: 20,
  },
  dangerZoneHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  dangerZoneTitle: {
    color: "#f87171",
    fontSize: 14,
    fontWeight: "900",
  },
  dangerZoneText: {
    color: "#cbd5e1",
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 14,
  },
  deleteAccountButton: {
    backgroundColor: "#dc2626",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: "center",
    shadowColor: "#dc2626",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  deleteAccountButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },
  manageAccountButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.3)",
    backgroundColor: "rgba(56, 189, 248, 0.08)",
    marginBottom: 12,
  },
  manageAccountButtonText: {
    color: "#38bdf8",
    fontWeight: "700",
    fontSize: 12,
  },

  // Modal Styles for Account Deletion
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContainer: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#0b1329",
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "900",
  },
  modalSubtitle: {
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalCloseBtnText: {
    color: "#94a3b8",
    fontSize: 16,
    fontWeight: "bold",
  },
  deleteWarningBox: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  deleteWarningText: {
    color: "#f87171",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 6,
  },
  deleteWarningBullet: {
    color: "#cbd5e1",
    fontSize: 11,
    lineHeight: 18,
  },
  modalActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#1e293b",
    alignItems: "center",
  },
  modalCancelBtnText: {
    color: "#cbd5e1",
    fontSize: 13,
    fontWeight: "700",
  },
  modalConfirmDeleteBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#dc2626",
    alignItems: "center",
  },
  modalConfirmDeleteBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
  },
  copyIdPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#1e293b",
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 8,
  },
  copyIdPillText: {
    fontSize: 11,
    color: "#cbd5e1",
    fontWeight: "700",
  },
  preferencesDivider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    marginVertical: 18,
  },
  subSectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#f8fafc",
    marginBottom: 4,
  },
  prefButtonsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 6,
  },
  prefButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
  },
  prefButtonActive: {
    borderWidth: 1.5,
  },
  prefButtonText: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: "600",
  },
  inputSubHint: {
    fontSize: 12,
    color: "#94a3b8",
    marginBottom: 10,
    lineHeight: 16,
  },
  changePasswordCard: {
    backgroundColor: "rgba(30, 41, 59, 0.6)",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    marginTop: 12,
  },
  changePasswordHeader: {
    marginBottom: 12,
  },
  changePasswordTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#f8fafc",
    marginBottom: 4,
  },
  changePasswordDesc: {
    fontSize: 12,
    color: "#94a3b8",
    lineHeight: 16,
  },
  changePasswordButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  changePasswordButtonText: {
    color: "#020617",
    fontSize: 13,
    fontWeight: "900",
  },
  envBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: "center",
  },
  envBadgeDev: {
    backgroundColor: "rgba(251, 191, 36, 0.08)",
    borderColor: "rgba(251, 191, 36, 0.35)",
  },
  envBadgeProd: {
    backgroundColor: "rgba(74, 222, 128, 0.08)",
    borderColor: "rgba(74, 222, 128, 0.35)",
  },
  envBadgeDot: {
    fontSize: 16,
  },
  envBadgeLabel: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  envBadgeDb: {
    fontSize: 10,
    color: "#64748b",
    fontWeight: "500",
    marginTop: 1,
  },
  // Photo picker styles
  photoPickerRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  photoPickBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: "rgba(30, 41, 59, 0.8)",
    borderWidth: 1.5,
    borderStyle: "dashed",
  },
  photoPickIcon: {
    fontSize: 28,
  },
  photoPickLabel: {
    fontSize: 12,
    color: "#94a3b8",
    fontWeight: "700",
  },
  photoPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 10,
    backgroundColor: "rgba(30, 41, 59, 0.6)",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  photoPreviewActions: {
    flex: 1,
    gap: 8,
  },
  photoActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "rgba(30, 41, 59, 0.8)",
    borderWidth: 1,
  },
  photoActionIcon: {
    fontSize: 14,
  },
  photoActionText: {
    fontSize: 12,
    fontWeight: "700",
  },
  avatarPhotoSeparator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginVertical: 10,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  separatorText: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
  },
  uploadOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(2, 6, 23, 0.75)",
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    zIndex: 10,
  },
  uploadOverlayText: {
    fontSize: 13,
    fontWeight: "700",
  },
});
