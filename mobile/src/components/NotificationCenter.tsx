import React from "react";
import {
  Modal,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Platform,
} from "react-native";
import {
  Bell,
  CheckCheck,
  Sparkles,
  Trash2,
  X,
  Clock,
  ArrowRight,
} from "lucide-react-native";
import type { PoopNotification } from "../hooks/usePoopNotifications";
import { formatTimeAgo } from "../services/cuiterService";

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: PoopNotification[];
  unreadCount: number;
  onMarkAllAsRead: () => void;
  onClearNotifications: () => void;
  permission?: string;
  onRequestPermission?: () => Promise<string>;
  onSelectNotification?: (item: PoopNotification) => void;
}

export default function NotificationCenter({
  isOpen,
  onClose,
  notifications,
  unreadCount,
  onMarkAllAsRead,
  onClearNotifications,
  permission = "granted",
  onRequestPermission,
  onSelectNotification,
}: NotificationCenterProps) {
  if (!isOpen) return null;

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={styles.panelContainer}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View style={styles.bellIconBox}>
                <Bell size={18} color="#eab308" />
              </View>
              <View>
                <Text style={styles.panelTitle}>Notificações</Text>
                <Text style={styles.panelSubtitle}>
                  {unreadCount > 0
                    ? `${unreadCount} não lida(s)`
                    : "Tempo real corporativo"}
                </Text>
              </View>
            </View>

            <View style={styles.headerActions}>
              {unreadCount > 0 && (
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={onMarkAllAsRead}
                  activeOpacity={0.7}
                >
                  <CheckCheck size={16} color="#eab308" />
                  <Text style={styles.actionBtnText}>Lidas</Text>
                </TouchableOpacity>
              )}

              {notifications.length > 0 && (
                <TouchableOpacity
                  style={styles.iconActionBtn}
                  onPress={onClearNotifications}
                  activeOpacity={0.7}
                >
                  <Trash2 size={16} color="#94a3b8" />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.closeBtn}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <X size={18} color="#94a3b8" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Web Browser Permission Banner */}
          {permission === "default" && onRequestPermission && (
            <View style={styles.permissionBanner}>
              <Sparkles size={16} color="#eab308" style={{ marginTop: 2 }} />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.permissionTitle}>
                  Notificações no Navegador
                </Text>
                <Text style={styles.permissionDesc}>
                  Receba alertas na área de trabalho quando colegas pontuarem no
                  trono.
                </Text>
                <TouchableOpacity
                  style={styles.permissionBtn}
                  onPress={() => void onRequestPermission()}
                  activeOpacity={0.8}
                >
                  <Text style={styles.permissionBtnText}>Ativar Alertas</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Notifications List */}
          <ScrollView
            style={styles.listScrollView}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          >
            {notifications.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <Text style={{ fontSize: 32 }}>🚽</Text>
                </View>
                <Text style={styles.emptyTitle}>Nenhuma pontuação recente</Text>
                <Text style={styles.emptySubtitle}>
                  Quando algum colega registrar trono ou transferir Poopcoins, o
                  alerta aparecerá aqui em tempo real.
                </Text>
              </View>
            ) : (
              notifications.map((item) => {
                const isUnread = !item.read;
                const isPoopcoin = item.type === "poopcoin";
                const isScore = item.type === "score";

                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.notificationItem,
                      isUnread && styles.notificationItemUnread,
                    ]}
                    activeOpacity={0.8}
                    onPress={() => onSelectNotification?.(item)}
                  >
                    <View
                      style={[
                        styles.itemTypeBadge,
                        isPoopcoin
                          ? styles.itemTypePoopcoin
                          : styles.itemTypeScore,
                      ]}
                    >
                      <Text style={{ fontSize: 16 }}>
                        {isPoopcoin ? "🪙" : "🚽"}
                      </Text>
                    </View>

                    <View style={styles.itemContent}>
                      <View style={styles.itemTopRow}>
                        <Text style={styles.itemTitle} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <View style={styles.timeRow}>
                          <Clock size={11} color="#64748b" />
                          <Text style={styles.timeText}>
                            {formatTimeAgo(item.timestamp)}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.itemMessage} numberOfLines={2}>
                        {item.message}
                      </Text>

                      <View style={styles.itemFooter}>
                        {item.points && (
                          <View style={styles.pointsPill}>
                            <Text style={styles.pointsPillText}>
                              +{item.points} pts
                            </Text>
                          </View>
                        )}
                        {item.amount && (
                          <View style={styles.poopcoinPill}>
                            <Text style={styles.poopcoinPillText}>
                              +{item.amount} PC
                            </Text>
                          </View>
                        )}
                        {item.userName && (
                          <Text style={styles.userNameSnippet} numberOfLines={1}>
                            de {item.userName}
                          </Text>
                        )}
                      </View>
                    </View>

                    {isUnread && <View style={styles.unreadDot} />}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  panelContainer: {
    backgroundColor: "#0f172a",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.25)",
    maxHeight: "82%",
    paddingBottom: Platform.OS === "ios" ? 30 : 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  bellIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(234, 179, 8, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.3)",
  },
  panelTitle: {
    color: "#f8fafc",
    fontSize: 16,
    fontWeight: "900",
  },
  panelSubtitle: {
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: "500",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(234, 179, 8, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  actionBtnText: {
    color: "#eab308",
    fontSize: 11,
    fontWeight: "700",
  },
  iconActionBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "#1e293b",
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "#1e293b",
  },
  permissionBanner: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "rgba(234, 179, 8, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.25)",
  },
  permissionTitle: {
    color: "#f8fafc",
    fontSize: 12,
    fontWeight: "700",
  },
  permissionDesc: {
    color: "#94a3b8",
    fontSize: 11,
    marginTop: 2,
  },
  permissionBtn: {
    marginTop: 8,
    backgroundColor: "#eab308",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  permissionBtnText: {
    color: "#020617",
    fontSize: 11,
    fontWeight: "800",
  },
  listScrollView: {
    marginTop: 6,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 20,
    gap: 8,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#1e293b",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 4,
  },
  emptySubtitle: {
    color: "#64748b",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
  notificationItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#334155",
    gap: 12,
  },
  notificationItemUnread: {
    backgroundColor: "rgba(30, 41, 59, 0.95)",
    borderColor: "rgba(234, 179, 8, 0.4)",
  },
  itemTypeBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  itemTypeScore: {
    backgroundColor: "rgba(234, 179, 8, 0.15)",
  },
  itemTypePoopcoin: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
  },
  itemContent: {
    flex: 1,
  },
  itemTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  itemTitle: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "800",
    flex: 1,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  timeText: {
    color: "#64748b",
    fontSize: 10,
  },
  itemMessage: {
    color: "#cbd5e1",
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 4,
  },
  itemFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  pointsPill: {
    backgroundColor: "rgba(234, 179, 8, 0.15)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(234, 179, 8, 0.3)",
  },
  pointsPillText: {
    color: "#eab308",
    fontSize: 10,
    fontWeight: "800",
  },
  poopcoinPill: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.3)",
  },
  poopcoinPillText: {
    color: "#f59e0b",
    fontSize: 10,
    fontWeight: "800",
  },
  userNameSnippet: {
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: "500",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#eab308",
  },
});
