import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { initial, type PassMark } from "@voya/core";
import { useTheme } from "@/lib/theme";

/** The Atlas Premium Pass mark (mockup 8a): a four-point compass star on the accent amber. */
export function PassStar({ size = 12, color }: { size?: number; color?: string }) {
  const t = useTheme();
  // The glyph is a four-point star (U+2726); no SVG dependency needed for a 12pt mark.
  return <Text accessible={false} importantForAccessibility="no" style={{ fontSize: size, lineHeight: Math.round(size * 1.15), color: color ?? t.premium, fontFamily: t.font.bold }}>✦</Text>;
}

/** Avatar with the mark: ring + corner badge for holders, ring only for gifted access. Decorative unless labelled. */
export function Avatar({ name, color, size = 40, mark = null, label }: { name: string; color?: string; size?: number; mark?: PassMark; label?: string }) {
  const t = useTheme();
  const badge = Math.max(14, Math.round(size * 0.4));
  return (
    <View accessible={!!label} accessibilityRole={label ? "image" : undefined} accessibilityLabel={label} importantForAccessibility={label ? "yes" : "no-hide-descendants"} style={{ width: size, height: size }}>
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color ?? t.primary, alignItems: "center", justifyContent: "center", borderWidth: mark ? 2 : 0, borderColor: t.premium }}>
        <Text style={{ color: "#fff", fontSize: Math.round(size * 0.42), fontFamily: t.font.extrabold }}>{initial(name)}</Text>
      </View>
      {mark === "pass" && (
        <View style={{ position: "absolute", right: -3, bottom: -3, width: badge, height: badge, borderRadius: badge / 2, backgroundColor: t.premium, borderWidth: 2, borderColor: t.surface, alignItems: "center", justifyContent: "center" }}>
          <PassStar size={Math.round(badge * 0.55)} color="#fff" />
        </View>
      )}
    </View>
  );
}

/** "Atlas Premium Pass" chip, or the dark gifted state "Atlas · GIFTED · 2d left". */
export function PassChip({ mark, children }: { mark?: PassMark; children?: ReactNode }) {
  const t = useTheme();
  const gifted = mark === "gifted";
  return (
    <View style={{ height: 26, paddingHorizontal: 9, borderRadius: 8, backgroundColor: gifted ? t.ink : t.premiumBg, flexDirection: "row", alignItems: "center", gap: 5 }}>
      <PassStar size={11} color={gifted ? t.premium : t.premiumText} />
      <Text style={{ color: gifted ? t.onInk : t.premiumText, fontSize: 11.5, fontFamily: t.font.bold }}>{gifted ? `Atlas${children ? ` · ${children}` : ""}` : children ?? "Atlas Premium Pass"}</Text>
    </View>
  );
}
