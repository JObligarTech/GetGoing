import { Modal, Platform, Pressable, Text, View } from "react-native";
import { PERMISSION_COPY, type Capability } from "@voya/core";
import { Button } from "@/components/ui";
import { useTheme } from "@/lib/theme";

/**
 * Pre-permission sheet (mockup 7a): explains why before the OS prompt, once per device.
 * The caller decides what "allow" does (usually the real request) and what "decline" falls back to.
 */
export function PermissionSheet({ cap, context, visible, onAllow, onDecline }: { cap: Capability; context?: string; visible: boolean; onAllow: () => void; onDecline: () => void }) {
  const t = useTheme();
  const copy = PERMISSION_COPY[cap];
  const os = Platform.OS === "ios" ? "iOS" : "Android";
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDecline} accessibilityViewIsModal>
      <Pressable accessibilityLabel="Close" accessibilityRole="button" onPress={onDecline} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }} />
      <View style={{ backgroundColor: t.canvas, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36, gap: 12 }}>
        <Text accessibilityRole="header" style={{ fontSize: 20, lineHeight: 26, fontFamily: t.font.extrabold, color: t.text, letterSpacing: -0.3 }}>{copy.title}</Text>
        <Text style={{ fontSize: 14, color: t.textMuted, fontFamily: t.font.regular, lineHeight: 20 }}>{copy.lead(context)}</Text>
        {copy.points.map((p) => (
          <View key={p} style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
            <View accessible={false} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: t.primary, marginTop: 7 }} />
            <Text style={{ flex: 1, fontSize: 13, color: t.text, fontFamily: t.font.regular, lineHeight: 18 }}>{p}</Text>
          </View>
        ))}
        <Button size="cta" label={copy.allow} onPress={onAllow} />
        <Button variant="ghost" label={copy.decline} onPress={onDecline} />
        <Text style={{ textAlign: "center", fontSize: 11.5, color: t.textMuted, fontFamily: t.font.regular }}>{copy.after(os)} See our Privacy Policy in Settings.</Text>
      </View>
    </Modal>
  );
}
