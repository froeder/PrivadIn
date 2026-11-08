import React, { useState } from "react";
import {
  Modal,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { ZoomIn, ZoomOut, Check, X, RotateCcw } from "lucide-react-native";

interface AvatarCropperProps {
  isOpen: boolean;
  imageUrl: string;
  onApply: (cropData: {
    zoom: number;
    offsetX: number;
    offsetY: number;
    imageUrl: string;
  }) => void | Promise<void>;
  onCancel: () => void;
}

const CROP_BOX_SIZE = 220;

export default function AvatarCropper({
  isOpen,
  imageUrl,
  onApply,
  onCancel,
}: AvatarCropperProps) {
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [isApplying, setIsApplying] = useState(false);

  if (!isOpen) return null;

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(2.5, Number((prev + 0.2).toFixed(1))));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(1, Number((prev - 0.2).toFixed(1))));
  };

  const handleReset = () => {
    setZoom(1);
    setOffsetX(0);
    setOffsetY(0);
  };

  const handleApply = async () => {
    setIsApplying(true);
    try {
      await onApply({
        zoom,
        offsetX,
        offsetY,
        imageUrl,
      });
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Ajustar Avatar Circular</Text>
              <Text style={styles.subtitle}>
                Ajuste o zoom e o enquadramento do seu avatar
              </Text>
            </View>
            <TouchableOpacity
              onPress={onCancel}
              style={styles.closeBtn}
              disabled={isApplying}
            >
              <X size={18} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          {/* Crop Container with Circular Mask */}
          <View style={styles.cropArea}>
            <View style={styles.circularMaskContainer}>
              <Image
                source={{ uri: imageUrl }}
                style={[
                  styles.cropImage,
                  {
                    transform: [
                      { scale: zoom },
                      { translateX: offsetX },
                      { translateY: offsetY },
                    ],
                  },
                ]}
                resizeMode="cover"
              />
              <View style={styles.circularBorderOverlay} />
            </View>
            <Text style={styles.cropHint}>Pré-visualização do corte circular</Text>
          </View>

          {/* Controls */}
          <View style={styles.controlsContainer}>
            <View style={styles.zoomRow}>
              <Text style={styles.controlLabel}>Zoom: {zoom.toFixed(1)}x</Text>

              <View style={styles.zoomButtonsRow}>
                <TouchableOpacity
                  style={[styles.zoomBtn, zoom <= 1 && styles.zoomBtnDisabled]}
                  onPress={handleZoomOut}
                  disabled={zoom <= 1}
                  activeOpacity={0.7}
                >
                  <ZoomOut size={16} color={zoom <= 1 ? "#64748b" : "#f8fafc"} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.zoomBtn, zoom >= 2.5 && styles.zoomBtnDisabled]}
                  onPress={handleZoomIn}
                  disabled={zoom >= 2.5}
                  activeOpacity={0.7}
                >
                  <ZoomIn size={16} color={zoom >= 2.5 ? "#64748b" : "#f8fafc"} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.resetBtn}
                  onPress={handleReset}
                  activeOpacity={0.7}
                >
                  <RotateCcw size={14} color="#eab308" />
                  <Text style={styles.resetBtnText}>Redefinir</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Position Adjustment Sliders or D-Pad */}
            <View style={styles.positionControlsRow}>
              <TouchableOpacity
                style={styles.posBtn}
                onPress={() => setOffsetX((x) => x - 10)}
                activeOpacity={0.7}
              >
                <Text style={styles.posBtnText}>‹ Esq</Text>
              </TouchableOpacity>

              <View style={styles.posColVertical}>
                <TouchableOpacity
                  style={styles.posBtn}
                  onPress={() => setOffsetY((y) => y - 10)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.posBtnText}>▲ Cima</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.posBtn}
                  onPress={() => setOffsetY((y) => y + 10)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.posBtnText}>▼ Baixo</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.posBtn}
                onPress={() => setOffsetX((x) => x + 10)}
                activeOpacity={0.7}
              >
                <Text style={styles.posBtnText}>Dir ›</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onCancel}
              disabled={isApplying}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.applyBtn}
              onPress={handleApply}
              disabled={isApplying}
              activeOpacity={0.8}
            >
              {isApplying ? (
                <ActivityIndicator size="small" color="#020617" />
              ) : (
                <>
                  <Check size={16} color="#020617" />
                  <Text style={styles.applyBtnText}>Salvar Avatar</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalCard: {
    backgroundColor: "#0f172a",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.3)",
    width: "100%",
    maxWidth: 380,
    padding: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  title: {
    color: "#f8fafc",
    fontSize: 16,
    fontWeight: "900",
  },
  subtitle: {
    color: "#94a3b8",
    fontSize: 11,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    backgroundColor: "#1e293b",
    borderRadius: 8,
  },
  cropArea: {
    alignItems: "center",
    marginVertical: 12,
  },
  circularMaskContainer: {
    width: CROP_BOX_SIZE,
    height: CROP_BOX_SIZE,
    borderRadius: CROP_BOX_SIZE / 2,
    overflow: "hidden",
    backgroundColor: "#1e293b",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  cropImage: {
    width: CROP_BOX_SIZE,
    height: CROP_BOX_SIZE,
  },
  circularBorderOverlay: {
    ...StyleSheet.absoluteFill,
    borderRadius: CROP_BOX_SIZE / 2,
    borderWidth: 3,
    borderColor: "#eab308",
  },
  cropHint: {
    color: "#64748b",
    fontSize: 11,
    marginTop: 8,
  },
  controlsContainer: {
    backgroundColor: "#1e293b",
    borderRadius: 16,
    padding: 14,
    marginVertical: 10,
    gap: 12,
  },
  zoomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  controlLabel: {
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "700",
  },
  zoomButtonsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  zoomBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#334155",
    alignItems: "center",
    justifyContent: "center",
  },
  zoomBtnDisabled: {
    opacity: 0.4,
  },
  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(234, 179, 8, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },
  resetBtnText: {
    color: "#eab308",
    fontSize: 11,
    fontWeight: "700",
  },
  positionControlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  posColVertical: {
    gap: 6,
  },
  posBtn: {
    backgroundColor: "#334155",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: "center",
  },
  posBtnText: {
    color: "#cbd5e1",
    fontSize: 11,
    fontWeight: "700",
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#1e293b",
    alignItems: "center",
  },
  cancelBtnText: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: "700",
  },
  applyBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#eab308",
  },
  applyBtnText: {
    color: "#020617",
    fontSize: 13,
    fontWeight: "900",
  },
});
