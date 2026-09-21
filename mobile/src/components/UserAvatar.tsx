import React, { useState, useEffect } from "react";
import { StyleSheet, View, Text, Image } from "react-native";

interface UserAvatarProps {
  avatar?: string | null;
  badge?: string | null;
  name?: string | null;
  size?: number;
  borderColor?: string;
  borderWidth?: number;
  backgroundColor?: string;
  textColor?: string;
  fontSize?: number;
}

export default function UserAvatar({
  avatar,
  badge,
  name,
  size = 44,
  borderColor = "#334155",
  borderWidth = 1.5,
  backgroundColor = "#1e293b",
  textColor = "#eab308",
  fontSize,
}: UserAvatarProps) {
  const [imageError, setImageError] = useState(false);

  // Reset error state whenever the avatar URL changes so the new image gets a fresh attempt
  useEffect(() => {
    setImageError(false);
  }, [avatar]);

  // Convert dicebear svg to png if necessary for native image rendering
  let resolvedAvatarUri: string | null = null;
  if (avatar && typeof avatar === "string" && avatar.trim().length > 0) {
    let uri = avatar.trim();
    if (uri.includes("api.dicebear.com") && uri.includes("/svg")) {
      uri = uri.replace("/svg", "/png");
    }
    if (uri.startsWith("http://") || uri.startsWith("https://") || uri.startsWith("data:")) {
      resolvedAvatarUri = uri;
    }
  }


  const initialLetter = (name || "?").trim().charAt(0).toUpperCase() || "?";
  const displayBadge = badge && badge.trim().length > 0 ? badge.trim() : null;
  const isEmojiOrTextAvatar = avatar && !resolvedAvatarUri && avatar.trim().length > 0;
  const displayText = displayBadge || (isEmojiOrTextAvatar ? avatar.trim() : initialLetter);

  const dynamicStyles = {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth,
    borderColor,
    backgroundColor,
  };

  const calculatedFontSize = fontSize || Math.round(size * 0.45);

  if (resolvedAvatarUri && !imageError) {
    return (
      <View style={[styles.container, dynamicStyles]}>
        <Image
          source={{ uri: resolvedAvatarUri }}
          style={{ width: "100%", height: "100%", borderRadius: size / 2 }}
          onError={() => setImageError(true)}
          resizeMode="cover"
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, dynamicStyles]}>
      <Text
        style={[
          styles.text,
          {
            color: displayBadge || isEmojiOrTextAvatar ? undefined : textColor,
            fontSize: displayBadge || isEmojiOrTextAvatar ? Math.round(size * 0.5) : calculatedFontSize,
          },
        ]}
      >
        {displayText}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  text: {
    fontWeight: "900",
    textAlign: "center",
  },
});
