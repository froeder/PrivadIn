import React, { useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Animated,
  Dimensions,
  Easing,
} from "react-native";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface ConfettiPieceProps {
  index: number;
  totalPieces: number;
}

const CONFETTI_COLORS = [
  "#fde047", // yellow-300
  "#f59e0b", // amber-500
  "#14b8a6", // teal-500
  "#3b82f6", // blue-500
  "#ec4899", // pink-500
  "#8b5cf6", // purple-500
  "#10b981", // emerald-500
  "#fbbf24", // amber-400
];

function ConfettiPiece({ index, totalPieces }: ConfettiPieceProps) {
  const animValue = useRef(new Animated.Value(0)).current;

  // Random parameters for natural confetti motion
  const startX = useRef(SCREEN_WIDTH * 0.5 + (Math.random() - 0.5) * 120).current;
  const startY = useRef(SCREEN_HEIGHT * 0.65).current;

  // Target explosion vectors
  const angle = (index / totalPieces) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
  const distance = Math.random() * (SCREEN_WIDTH * 0.6) + 60;
  const peakX = startX + Math.cos(angle) * distance;
  const peakY = startY - Math.abs(Math.sin(angle)) * (SCREEN_HEIGHT * 0.35 + Math.random() * 150);

  const endX = peakX + (Math.random() - 0.5) * 80;
  const endY = SCREEN_HEIGHT + 40;

  const color = CONFETTI_COLORS[index % CONFETTI_COLORS.length];
  const size = Math.random() * 6 + 6;
  const isCircle = index % 3 === 0;
  const rotationTotal = (Math.random() > 0.5 ? 1 : -1) * (720 + Math.random() * 720);

  useEffect(() => {
    Animated.timing(animValue, {
      toValue: 1,
      duration: 2400 + Math.random() * 800,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      useNativeDriver: true,
      delay: Math.random() * 150,
    }).start();
  }, [animValue]);

  // Two-stage physics: 0 -> 0.35 is burst up/out, 0.35 -> 1 is gravity fall down
  const translateX = animValue.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [startX, peakX, endX],
  });

  const translateY = animValue.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [startY, peakY, endY],
  });

  const rotate = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", `${rotationTotal}deg`],
  });

  const opacity = animValue.interpolate({
    inputRange: [0, 0.1, 0.8, 1],
    outputRange: [0, 1, 1, 0],
  });

  const scale = animValue.interpolate({
    inputRange: [0, 0.2, 0.8, 1],
    outputRange: [0.3, 1, 0.9, 0.5],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.piece,
        {
          width: size,
          height: isCircle ? size : size * 1.6,
          borderRadius: isCircle ? size / 2 : 2,
          backgroundColor: color,
          opacity,
          transform: [
            { translateX },
            { translateY },
            { rotate },
            { scale },
          ],
        },
      ]}
    />
  );
}

interface ConfettiEffectProps {
  active: boolean;
  count?: number;
  onEnd?: () => void;
}

export default function ConfettiEffect({
  active,
  count = 60,
  onEnd,
}: ConfettiEffectProps) {
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => {
      onEnd?.();
    }, 3500);
    return () => clearTimeout(timer);
  }, [active, onEnd]);

  if (!active) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {Array.from({ length: count }).map((_, i) => (
        <ConfettiPiece key={i} index={i} totalPieces={count} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    elevation: 99,
  },
  piece: {
    position: "absolute",
    top: 0,
    left: 0,
  },
});
