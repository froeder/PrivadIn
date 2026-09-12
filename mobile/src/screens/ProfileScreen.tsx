import React, { useState, useMemo } from "react";
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
import { AppUser, WorkSchedule } from "../types";
import { signOutUser } from "../services/authService";
import {
  updateUserProfileCustomization,
  updateUserWorkSchedule,
  updateUserFinancialSettings,
} from "../services/poopService";
import PoopcoinWalletCard from "../components/PoopcoinWalletCard";
import TransferPoopcoinsModal from "../components/TransferPoopcoinsModal";
import UserProfileModal from "../components/UserProfileModal";
import UserAvatar from "../components/UserAvatar";

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

  // Active section tab in screen
  const [activeSection, setActiveSection] = useState<"profile" | "work" | "financial">("profile");

  // 1. Profile customization state
  const [nickname, setNickname] = useState(user.nickname || user.name || "");
  const [bio, setBio] = useState(user.bio || "");
  const [selectedAvatar, setSelectedAvatar] = useState(user.avatar || "🚽");
  const [customAvatarInput, setCustomAvatarInput] = useState("");
  const [selectedTheme, setSelectedTheme] = useState(user.themeColor || "#eab308");
  const [savingProfile, setSavingProfile] = useState(false);

  // 2. Work Schedule state
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
  const [savingWork, setSavingWork] = useState(false);

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

  // Handler: Save Profile Customization
  const handleSaveProfile = async () => {
    const finalAvatar = customAvatarInput.trim() || selectedAvatar;
    if (!nickname.trim()) {
      Alert.alert("Aviso", "Por favor, insira um apelido ou nome de guerra.");
      return;
    }

    setSavingProfile(true);
    try {
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

  // Handler: Save Work Schedule
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

      await updateUserWorkSchedule(user.uid, schedule);
      Alert.alert("Jornada Salva! ⏰", "Seus horários de expediente e fuso horário foram atualizados.");
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

  const userThemeColor = user.themeColor || selectedTheme || "#eab308";
  const userHourlyRate = user.hourlyRate || (user.salary ? user.salary / 176 : 20);

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      {/* Profile Header Card */}
      <View style={styles.profileHeader}>
        <UserAvatar
          avatar={user.avatar || selectedAvatar}
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

          {/* Theme Color Selector */}
          <Text style={[styles.inputLabel, { marginTop: 16 }]}>Cor Tema do Aplicativo</Text>
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
});
