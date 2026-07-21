import React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

type Colors = ReturnType<typeof useColors>;

/** Top padding for custom headers — handles notch on native, status bar on web. */
export function useTopInset(): number {
  const insets = useSafeAreaInsets();
  return Platform.OS === "web" ? 67 : insets.top;
}

/** Bottom padding so scroll content clears the tab bar / home indicator. */
export function useBottomInset(extra = 24): number {
  const insets = useSafeAreaInsets();
  const base = Platform.OS === "web" ? 84 : 56 + insets.bottom;
  return base + extra;
}

export function priorityColor(colors: Colors, priority: string): string {
  switch (priority) {
    case "high":
      return colors.priorityHigh;
    case "medium":
      return colors.priorityMedium;
    case "low":
      return colors.priorityLow;
    default:
      return colors.mutedForeground;
  }
}

const PLATFORM_ICONS: Record<
  string,
  React.ComponentProps<typeof MaterialCommunityIcons>["name"]
> = {
  youtube: "youtube",
  instagram: "instagram",
  tiktok: "music-note",
  twitter: "twitter",
  x: "twitter",
  linkedin: "linkedin",
  twitch: "twitch",
  facebook: "facebook",
  podcast: "podcast",
  blog: "post-outline",
  newsletter: "email-outline",
};

export function PlatformIcon({
  platform,
  size = 18,
  color,
}: {
  platform: string;
  size?: number;
  color: string;
}) {
  const name =
    PLATFORM_ICONS[platform?.toLowerCase?.() ?? ""] ?? "shape-outline";
  return <MaterialCommunityIcons name={name} size={size} color={color} />;
}

export function Header({
  title,
  subtitle,
  left,
  right,
}: {
  title: string;
  subtitle?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
}) {
  const colors = useColors();
  const top = useTopInset();
  return (
    <View
      style={[
        styles.header,
        {
          paddingTop: top + 10,
          backgroundColor: colors.background,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <View style={styles.headerRow}>
        {left ? <View style={styles.headerSide}>{left}</View> : null}
        <View style={styles.headerTitles}>
          <Text
            numberOfLines={1}
            style={[styles.headerTitle, { color: colors.foreground }]}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              numberOfLines={1}
              style={[styles.headerSubtitle, { color: colors.mutedForeground }]}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right ? (
          <View style={[styles.headerSide, styles.headerSideRight]}>
            {right}
          </View>
        ) : null}
      </View>
    </View>
  );
}

export function IconButton({
  name,
  onPress,
  color,
  size = 24,
  disabled,
  haptic = true,
  testID,
}: {
  name: React.ComponentProps<typeof Ionicons>["name"];
  onPress: () => void;
  color?: string;
  size?: number;
  disabled?: boolean;
  haptic?: boolean;
  testID?: string;
}) {
  const colors = useColors();
  return (
    <Pressable
      testID={testID}
      disabled={disabled}
      hitSlop={10}
      onPress={() => {
        if (haptic && Platform.OS !== "web") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
            () => {},
          );
        }
        onPress();
      }}
      style={({ pressed }) => ({
        opacity: disabled ? 0.3 : pressed ? 0.5 : 1,
      })}
    >
      <Ionicons name={name} size={size} color={color ?? colors.foreground} />
    </Pressable>
  );
}

export function Button({
  label,
  onPress,
  variant = "primary",
  loading,
  disabled,
  icon,
  testID,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "destructive";
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  testID?: string;
  style?: ViewStyle;
}) {
  const colors = useColors();
  const isDisabled = disabled || loading;

  const bg =
    variant === "primary"
      ? colors.primary
      : variant === "destructive"
        ? colors.destructive
        : colors.secondary;
  const fg =
    variant === "secondary" ? colors.foreground : colors.primaryForeground;

  return (
    <Pressable
      testID={testID}
      disabled={isDisabled}
      onPress={() => {
        if (Platform.OS !== "web") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
            () => {},
          );
        }
        onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: bg,
          borderRadius: colors.radius,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.buttonInner}>
          {icon ? (
            <Ionicons name={icon} size={18} color={fg} style={styles.buttonIcon} />
          ) : null}
          <Text style={[styles.buttonText, { color: fg }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function Badge({
  label,
  color,
  bg,
}: {
  label: string;
  color: string;
  bg?: string;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: bg ?? colors.secondary, borderRadius: 999 },
      ]}
    >
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

export function Avatar({
  name,
  size = 40,
  uri,
}: {
  name: string;
  size?: number;
  uri?: string | null;
}) {
  const colors = useColors();
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
        transition={150}
      />
    );
  }
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.primary,
        },
      ]}
    >
      <Text style={{ color: colors.primaryForeground, fontFamily: "Inter_700Bold", fontSize: size * 0.4 }}>
        {initials || "?"}
      </Text>
    </View>
  );
}

export function ProgressBar({
  value,
  color,
}: {
  value: number;
  color?: string;
}) {
  const colors = useColors();
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View style={[styles.progressTrack, { backgroundColor: colors.secondary }]}>
      <View
        style={[
          styles.progressFill,
          { width: `${pct * 100}%`, backgroundColor: color ?? colors.primary },
        ]}
      />
    </View>
  );
}

export function LoadingView({ label }: { label?: string }) {
  const colors = useColors();
  return (
    <View style={[styles.center, { backgroundColor: colors.background }]}>
      <ActivityIndicator color={colors.primary} size="large" />
      {label ? (
        <Text style={[styles.centerText, { color: colors.mutedForeground }]}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  subtitle?: string;
}) {
  const colors = useColors();
  return (
    <View style={styles.center}>
      <Ionicons name={icon} size={44} color={colors.mutedForeground} />
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={[styles.centerText, { color: colors.mutedForeground }]}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

export function ErrorView({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.center}>
      <Ionicons name="alert-circle-outline" size={44} color={colors.destructive} />
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
        Algo deu errado
      </Text>
      <Text style={[styles.centerText, { color: colors.mutedForeground }]}>
        {message}
      </Text>
      {onRetry ? (
        <View style={{ marginTop: 16, width: 180 }}>
          <Button label="Tentar novamente" onPress={onRetry} variant="secondary" icon="refresh" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerSide: {
    minWidth: 28,
    justifyContent: "center",
  },
  headerSideRight: {
    alignItems: "flex-end",
  },
  headerTitles: {
    flex: 1,
  },
  headerTitle: {
    fontFamily: "Inter_700Bold",
    fontSize: 26,
  },
  headerSubtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    marginTop: 2,
  },
  button: {
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  buttonInner: {
    flexDirection: "row",
    alignItems: "center",
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  badgeText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
    letterSpacing: 0.3,
  },
  avatar: {
    alignItems: "center",
    justifyContent: "center",
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    overflow: "hidden",
    width: "100%",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 10,
  },
  centerText: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    textAlign: "center",
  },
  emptyTitle: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 17,
    marginTop: 4,
  },
});
