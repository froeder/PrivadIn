import React, { useState } from "react";
import {
  Modal,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Check, ShieldCheck } from "lucide-react-native";

interface TermsModalProps {
  isOpen: boolean;
  termsText?: string;
  termsVersion?: number;
  onAccept: () => Promise<void>;
  onDecline: () => void;
  loading?: boolean;
}

const DEFAULT_TERMS_TEXT = [
  "Ao usar o PrivadIn, você concorda com a coleta e o armazenamento dos dados necessários para operar a competição.",
  "Isso inclui registros de horário, timezone, duração das sessões e dados necessários para o cálculo de pontuação e ranking.",
  "O aplicativo é um jogo corporativo de entretenimento e paródia da famosa cagada remunerada.",
  "Os termos podem mudar a qualquer momento. Quando houver alteração relevante, será necessário aceitar a nova versão para continuar usando o app.",
].join("\n\n");

export default function TermsModal({
  isOpen,
  termsText,
  termsVersion = 1,
  onAccept,
  onDecline,
  loading = false,
}: TermsModalProps) {
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAcceptPress = async () => {
    if (!agreed) {
      setError("Você precisa marcar a caixa concordando com os termos.");
      return;
    }
    setError(null);
    try {
      await onAccept();
    } catch (err: any) {
      setError(err.message || "Erro ao salvar aceite dos termos.");
    }
  };

  return (
    <Modal visible={isOpen} transparent animationType="slide">
      <View style={styles.backdrop}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <ShieldCheck size={28} color="#eab308" />
            </View>
            <Text style={styles.title}>Termos de Uso e Privacidade</Text>
            <Text style={styles.subtitle}>
              Versão {termsVersion} • Atualização Obrigatória
            </Text>
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {error}</Text>
            </View>
          )}

          {/* Terms content */}
          <View style={styles.termsBox}>
            <ScrollView style={styles.termsScroll} showsVerticalScrollIndicator>
              <Text style={styles.termsContent}>
                {termsText?.trim() || DEFAULT_TERMS_TEXT}
              </Text>
            </ScrollView>
          </View>

          {/* Checkbox */}
          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => {
              setAgreed(!agreed);
              if (error) setError(null);
            }}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, agreed && styles.checkboxActive]}>
              {agreed && <Check size={14} color="#020617" strokeWidth={3} />}
            </View>
            <Text style={styles.checkboxLabel}>
              Declaro que li e concordo com os Termos de Uso e Política de Privacidade do PrivadIn.
            </Text>
          </TouchableOpacity>

          {/* Buttons */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.declineButton]}
              onPress={onDecline}
              disabled={loading}
            >
              <Text style={styles.declineButtonText}>Recusar e Sair</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.acceptButton, (!agreed || loading) && styles.buttonDisabled]}
              onPress={handleAcceptPress}
              disabled={loading || !agreed}
            >
              {loading ? (
                <ActivityIndicator color="#020617" />
              ) : (
                <Text style={styles.acceptButtonText}>Aceitar e Entrar</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 23, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 480,
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
    alignItems: "center",
    marginBottom: 16,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(234, 179, 8, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: "900",
    color: "#f8fafc",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 3,
  },
  errorBox: {
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
  },
  termsBox: {
    backgroundColor: "#1e293b",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#334155",
    padding: 14,
    maxHeight: 220,
    marginBottom: 16,
  },
  termsScroll: {
    flexGrow: 0,
  },
  termsContent: {
    fontSize: 13,
    color: "#cbd5e1",
    lineHeight: 19,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
    paddingHorizontal: 4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#475569",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
    backgroundColor: "#1e293b",
  },
  checkboxActive: {
    backgroundColor: "#eab308",
    borderColor: "#eab308",
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 12,
    color: "#cbd5e1",
    lineHeight: 16,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
  },
  declineButton: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
    alignItems: "center",
    justifyContent: "center",
  },
  declineButtonText: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: "700",
  },
  acceptButton: {
    flex: 1.2,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: "#eab308",
    alignItems: "center",
    justifyContent: "center",
  },
  acceptButtonText: {
    color: "#020617",
    fontSize: 13,
    fontWeight: "800",
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
