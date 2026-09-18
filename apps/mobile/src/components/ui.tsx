import type { ReactNode } from "react";
import { AccessibilityInfo, Platform, Pressable, StyleSheet, Text, View, type AccessibilityState, type PressableProps, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { initial } from "@voya/core";
import { motion as motionTokens } from "@voya/tokens";
import { useTheme, type Theme } from "@/lib/theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type ButtonVariant = "primary" | "ink" | "secondary" | "ghost" | "translucent" | "light";

/**
 * Press feedback is a 3% scale via Reanimated, skipped when the OS "Reduce motion"
 * setting is on. Minimum 44pt hit area; announces as a button with its label.
 */
export function Button({ variant = "primary", size = "md", label, icon, full, style, disabled, ...rest }: Omit<PressableProps, "style" | "children"> & {
  variant?: ButtonVariant; size?: "cta" | "md" | "sm"; label: string; icon?: ReactNode; full?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const reduce = useReducedMotion();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const colors: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: t.primary, fg: t.onPrimary },
    ink: { bg: t.ink, fg: t.onInk },
    secondary: { bg: t.surface, fg: t.text, border: t.borderStrong },
    ghost: { bg: "transparent", fg: t.primary },
    translucent: { bg: "rgba(255,255,255,0.10)", fg: "#F1F3EF" },
    light: { bg: "#F1F3EF", fg: "#121614" },
  };
  const c = colors[variant];
  const height = size === "cta" ? 52 : size === "sm" ? 44 : 44;
  // Android mockups use pill buttons; iOS uses 14px corners.
  const rounded = Platform.OS === "android" ? 999 : 14;
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPressIn={() => { if (!reduce) scale.set(withTiming(motionTokens.pressScale, { duration: motionTokens.duration.fast })); }}
      onPressOut={() => { scale.set(withTiming(1, { duration: motionTokens.duration.base })); }}
      style={[
        { height, minHeight: 44, borderRadius: rounded, paddingHorizontal: 18, backgroundColor: c.bg, borderWidth: c.border ? 1 : 0, borderColor: c.border, opacity: disabled ? 0.5 : 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
        full && { alignSelf: "stretch" },
        animated,
        style,
      ]}
      {...rest}
    >
      {icon}
      <Text style={{ color: c.fg, fontSize: 15, fontFamily: t.font.bold }}>{label}</Text>
    </AnimatedPressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return <View style={[{ backgroundColor: t.surface, borderColor: t.border, borderWidth: 1, borderRadius: 14, overflow: "hidden" }, style]}>{children}</View>;
}

export function Eyebrow({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  return <Text accessibilityRole="header" style={[{ fontSize: 12, fontFamily: t.font.bold, color: t.textMuted, textTransform: "uppercase", letterSpacing: 1 }, style]}>{children}</Text>;
}

export function Dot({ color, size = 10 }: { color: string; size?: number }) {
  return <View accessible={false} importantForAccessibility="no" style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;
}

/** Lettered tile ("J" for Japan 2027) — decorative; the row text carries the name. */
export function Tile({ name, color, size = 52, radius = 12, invert }: { name: string; color?: string; size?: number; radius?: number; invert?: boolean }) {
  const t = useTheme();
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ width: size, height: size, borderRadius: radius, backgroundColor: invert ? t.surfaceTint : color ?? t.primary, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: invert ? t.onTint : "#fff", fontSize: Math.round(size * 0.42), fontFamily: t.font.extrabold }}>{initial(name)}</Text>
    </View>
  );
}

export function Chip({ children, tone = "tint" }: { children: ReactNode; tone?: "tint" | "plain" | "premium" }) {
  const t = useTheme();
  const bg = tone === "tint" ? t.surfaceTint : tone === "premium" ? t.premiumBg : "transparent";
  const fg = tone === "tint" ? t.onTint : tone === "premium" ? t.premiumText : t.textMuted;
  return (
    <View style={{ height: 26, paddingHorizontal: 9, borderRadius: 8, backgroundColor: bg, justifyContent: "center" }}>
      <Text style={{ color: fg, fontSize: 11.5, fontFamily: t.font.bold }}>{children}</Text>
    </View>
  );
}

export function IconCoin({ name, size = 40 }: { name: keyof typeof Ionicons.glyphMap; size?: number }) {
  const t = useTheme();
  return (
    <View accessible={false} importantForAccessibility="no" style={{ width: size, height: size, borderRadius: 10, backgroundColor: t.surfaceTint, alignItems: "center", justifyContent: "center" }}>
      <Ionicons name={name} size={Math.round(size / 2)} color={t.onTint} />
    </View>
  );
}

/** The list row every screen uses. `onPress` makes it a button; `accessibilityLabel` overrides the spoken name. */
export function ListRow({ leading, title, subtitle, trailing, onPress, active, chevron, accessibilityLabel, accessibilityState, last }: {
  leading?: ReactNode; title: string; subtitle?: string; trailing?: ReactNode; onPress?: () => void; active?: boolean; chevron?: boolean; accessibilityLabel?: string; accessibilityState?: AccessibilityState; last?: boolean;
}) {
  const t = useTheme();
  const inner = (
    <>
      {leading}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontSize: 15, fontFamily: t.font.semibold, color: t.text }}>{title}</Text>
        {subtitle ? <Text numberOfLines={1} style={{ fontSize: 12, color: t.textMuted, fontFamily: t.font.regular }}>{subtitle}</Text> : null}
      </View>
      {trailing}
      {chevron && <Ionicons name="chevron-forward" size={18} color={t.textFaint} accessible={false} />}
    </>
  );
  const style: ViewStyle = { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 56, backgroundColor: active ? t.surfaceTint : "transparent", borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderBottomColor: t.border };
  if (onPress) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? [title, subtitle].filter(Boolean).join(", ")} accessibilityState={{ selected: !!active, ...accessibilityState }} onPress={onPress} android_ripple={{ color: t.surfaceTint }} style={({ pressed }) => [style, pressed && { backgroundColor: t.surfaceTint }]}>
        {inner}
      </Pressable>
    );
  }
  return <View accessible accessibilityLabel={accessibilityLabel} style={style}>{inner}</View>;
}

export function PageHeader({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44, gap: 12 }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        {eyebrow ? <Text style={{ fontSize: 13, color: t.textMuted, fontFamily: t.font.medium }}>{eyebrow}</Text> : null}
        <Text accessibilityRole="header" numberOfLines={1} style={{ fontSize: 26, fontFamily: t.font.extrabold, color: t.text, letterSpacing: -0.5 }}>{title}</Text>
      </View>
      {action}
    </View>
  );
}

export function Hint({ children }: { children: string }) {
  const t = useTheme();
  return <Text style={{ backgroundColor: t.surfaceTint, color: t.onTint, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 13, fontFamily: t.font.semibold, lineHeight: 18 }}>{children}</Text>;
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  const t = useTheme();
  return (
    <Card style={{ alignItems: "center", gap: 10, paddingVertical: 36, paddingHorizontal: 24 }}>
      <Text style={{ fontSize: 16, fontFamily: t.font.bold, color: t.text, textAlign: "center" }}>{title}</Text>
      {body ? <Text style={{ fontSize: 13, color: t.textMuted, textAlign: "center", fontFamily: t.font.regular }}>{body}</Text> : null}
      {action}
    </Card>
  );
}

/** Announce a status change to VoiceOver/TalkBack without moving focus. */
export function announce(message: string) {
  AccessibilityInfo.announceForAccessibility(message);
}

export function screenStyles(t: Theme) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.canvas },
    content: { padding: 16, gap: 14, paddingBottom: 32 },
  });
}
