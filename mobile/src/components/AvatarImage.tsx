import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import UserAvatar from "./UserAvatar";

export interface AvatarImageProps {
  avatar?: string | null;
  name: string;
  email?: string;
  alt?: string;
  size?: number;
  style?: ViewStyle;
  badge?: string | null;
  borderColor?: string;
  borderWidth?: number;
  backgroundColor?: string;
  textColor?: string;
}

/**
 * AvatarImage component for React Native (Mobile).
 * Serves as direct drop-in compatible component with PWA's AvatarImage,
 * backed by the full native UserAvatar implementation.
 */
export function AvatarImage({
  avatar,
  name,
  email,
  size = 40,
  style,
  badge,
  borderColor = "#334155",
  borderWidth = 1.5,
  backgroundColor = "#1e293b",
  textColor = "#eab308",
}: AvatarImageProps) {
  return (
    <View style={[styles.wrapper, style]}>
      <UserAvatar
        avatar={avatar}
        name={name}
        badge={badge}
        size={size}
        borderColor={borderColor}
        borderWidth={borderWidth}
        backgroundColor={backgroundColor}
        textColor={textColor}
      />
    </View>
  );
}

export default AvatarImage;

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    justifyContent: "center",
  },
});
