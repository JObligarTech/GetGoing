import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
import {
  commonPrices, convert, countryName, currencyName, currencySymbol, formatMoney, formatRate, keypadPress, keypadValue, quickAmounts, TIP_PRESETS, tripCurrencies, updatedLabel,
  type CachedRate,
} from "@voya/core";
import { Button, Card, Chip, EmptyState, Eyebrow, PageHeader, announce, screenStyles } from "@/components/ui";
import { useData } from "@/lib/data";
import { fx } from "@/lib/providers";
import { useSession } from "@/lib/session";
import { prefs } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";

interface Adjust { kind: "tip" | "off"; pct: number }
interface SavedAmount { id: string; base: string; quote: string; amount: number; converted: number }
const ADD_OPTIONS = ["EUR", "GBP", "KRW", "CNY", "THB", "VND", "IDR", "SGD", "TWD", "HKD", "AUD", "CAD", "CHF", "INR", "MXN", "BRL", "NZD", "PHP", "USD", "JPY"];

/**
 * Currency: home currency → the trip's local currency with a keypad, quick amounts, tip and
 * percent-off presets, trip currency chips and cached rates that survive going offline.
 */
export default function CurrencyScreen() {
  const t = useTheme();
  const s = screenStyles(t);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const reduce = useReducedMotion();
  const { user } = useSession();
  const { now, active, bundle, addCurrency, removeCurrency } = useData();
  const home = user?.profile.home_currency ?? "USD";
  const local = active?.local_currency ?? null;
  // The pair follows the active trip (which loads async); the user's choice is kept per trip.
  const [pairState, setPairState] = useState<{ key: string | null; base: string; quote: string } | null>(null);
  const pair = pairState && pairState.key === (active?.id ?? null) ? pairState : { key: active?.id ?? null, base: home, quote: local ?? "EUR" };
  const { base, quote } = pair;
  const setQuote = (q: string) => setPairState({ ...pair, quote: q });
  const [display, setDisplay] = useState("100");
  const [rate, setRate] = useState<CachedRate | null>(null);
  const [rateError, setRateError] = useState<string | null>(null);
  const [adjust, setAdjust] = useState<Adjust | null>(null);
  const [picker, setPicker] = useState<"tip" | "off" | null>(null);
  const [saved, setSaved] = useState<SavedAmount[]>([]);
  const [status, setStatus] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [addCode, setAddCode] = useState("EUR");
  const [addLabel, setAddLabel] = useState("");

  useEffect(() => {
    let alive = true;
    prefs.get("currency.saved").then((raw) => { if (alive && raw) { try { setSaved(JSON.parse(raw) as SavedAmount[]); } catch { /* ignore */ } } }).catch(() => {});
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    let alive = true;
    fx.rate(base, quote).then((r) => { if (alive) { setRate(r); setRateError(null); } }).catch(() => { if (alive) { setRate(null); setRateError(`No rate for ${base} → ${quote} right now, and nothing cached yet.`); } });
    return () => { alive = false; };
  }, [base, quote]);

  if (!user || !active || !bundle) return <View style={s.screen}><View style={[s.content, { paddingTop: insets.top + 8 }]}><PageHeader eyebrow="Currency" title="No active trip" /><EmptyState title="Create a trip first" body="Currency converts to the trip's local currency by default." /></View></View>;

  const country = countryName(active.countries[0] ?? null);
  const amount = keypadValue(display);
  const adjusted = adjust ? Math.round(amount * (adjust.kind === "tip" ? 1 + adjust.pct / 100 : 1 - adjust.pct / 100) * 100) / 100 : amount;
  const converted = rate ? convert(adjusted, rate.rate, quote) : null;
  const label = (code: string) => (code === home ? "Home" : code === local ? `${country ?? "Trip"} · local` : bundle.tripCurrencies.find((c) => c.code === code)?.label ?? currencyName(code));
  const chips = tripCurrencies(bundle);
  const common = local ? commonPrices(local) : [];
  const commonRate = rate && ((rate.base === local && rate.quote === home) ? rate.rate : (rate.quote === local && rate.base === home) ? 1 / rate.rate : null);
  const press = (k: string) => setDisplay((d) => keypadPress(d, k, base));
  const swap = () => { if (converted != null) setDisplay(String(converted)); setPairState({ ...pair, base: quote, quote: base }); setAdjust(null); announce(`Now converting ${quote} to ${base}.`); };
  const pickQuote = (code: string) => setPairState({ ...pair, quote: code, base: code === base ? (quote === code ? home : quote) : base });
  const persist = async (list: SavedAmount[]) => { setSaved(list); try { await prefs.set("currency.saved", JSON.stringify(list)); } catch { /* ignore */ } };
  const save = () => {
    if (converted == null) return;
    void persist([{ id: crypto.randomUUID(), base, quote, amount: adjusted, converted }, ...saved].slice(0, 20));
    const m = `Saved ${formatMoney(adjusted, base)} = ${formatMoney(converted, quote)} on this device.`; setStatus(m); announce(m);
  };
  const submitAdd = async () => {
    const r = await addCurrency(addCode, addLabel.trim() || null);
    if ("error" in r) { setStatus(r.error); announce(r.error); return; }
    setAddOpen(false); setAddLabel(""); setQuote(r.code);
    const m = `${r.code} added to ${active.name}.`; setStatus(m); announce(m);
  };
  const remove = async (code: string) => {
    const r = await removeCurrency(code);
    if ("error" in r) { setStatus(r.error); return; }
    if (quote === code) setQuote(local ?? home);
    const m = `${code} removed.`; setStatus(m); announce(m);
  };
  const enter = (i: number) => (reduce ? undefined : FadeInDown.duration(220).delay(i * 40));
  const key = (k: string, aria?: string) => (
    <Pressable key={k} accessibilityRole="button" accessibilityLabel={aria ?? k} onPress={() => press(k)} style={({ pressed }) => ({ flex: 1, height: 56, borderRadius: 14, backgroundColor: pressed ? t.surfaceTint : t.surface, borderWidth: 1, borderColor: t.border, alignItems: "center", justifyContent: "center" })}>
      <Text style={{ fontSize: 20, fontFamily: t.font.extrabold, color: t.text }}>{k}</Text>
    </Pressable>
  );
  const accent = (label: string, aria: string, onPress: () => void, opts: { icon?: keyof typeof Ionicons.glyphMap; primary?: boolean; on?: boolean } = {}) => (
    <Pressable accessibilityRole="button" accessibilityLabel={aria} accessibilityState={{ selected: opts.on }} onPress={onPress} style={{ flex: 1, height: 56, borderRadius: 14, backgroundColor: opts.primary ? t.primary : t.surfaceTint, borderWidth: opts.on ? 2 : 0, borderColor: t.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
      {opts.icon ? <Ionicons name={opts.icon} size={18} color={opts.primary ? t.onPrimary : t.onTint} /> : null}
      {label ? <Text style={{ fontSize: 15, fontFamily: t.font.extrabold, color: opts.primary ? t.onPrimary : t.onTint }}>{label}</Text> : null}
    </Pressable>
  );

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={[s.content, { paddingTop: insets.top + 8 }]} keyboardShouldPersistTaps="handled">
        <Animated.View entering={enter(0)} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: t.borderStrong, backgroundColor: t.surface, alignItems: "center", justifyContent: "center" }}><Ionicons name="arrow-back" size={20} color={t.text} /></Pressable>
          <View style={{ flex: 1 }}><PageHeader eyebrow={active.name} title="Currency" action={<Chip tone="premium">Atlas Premium Pass</Chip>} /></View>
        </Animated.View>

        <Animated.View entering={enter(1)}>
          <Card style={{ padding: 16, gap: 4 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={{ fontSize: 12, fontFamily: t.font.bold, color: t.textMuted, textTransform: "uppercase", letterSpacing: 0.6 }}>{base} · {label(base)}</Text><Text style={{ fontSize: 12, fontFamily: t.font.bold, color: t.textMuted, textTransform: "uppercase" }}>{currencyName(base)}</Text></View>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
              <Text accessible={false} style={{ fontSize: 28, fontFamily: t.font.extrabold, color: t.textMuted }}>{currencySymbol(base)}</Text>
              <TextInput accessibilityLabel={`Amount in ${currencyName(base)}`} value={display} onChangeText={(v) => { const c = v.replace(/[^\d.]/g, ""); setDisplay(c === "" ? "0" : c); }} keyboardType="decimal-pad" selectTextOnFocus style={{ flex: 1, fontSize: 40, fontFamily: t.font.extrabold, color: t.text, letterSpacing: -0.8, padding: 0 }} />
            </View>
            {adjust ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ fontSize: 12.5, fontFamily: t.font.semibold, color: t.primary }}>{adjust.kind === "tip" ? `+ ${adjust.pct}% tip` : `− ${adjust.pct}% off`} = {formatMoney(adjusted, base)}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Remove adjustment" onPress={() => setAdjust(null)} style={{ height: 28, paddingHorizontal: 8, borderRadius: 14, backgroundColor: t.surfaceTint, justifyContent: "center" }}><Text style={{ fontSize: 11, fontFamily: t.font.bold, color: t.onTint }}>clear</Text></Pressable>
              </View>
            ) : null}
          </Card>
          <View style={{ alignItems: "center", marginVertical: -18, zIndex: 1 }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Swap currencies" onPress={swap} style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: t.ink, borderWidth: 4, borderColor: t.canvas, alignItems: "center", justifyContent: "center" }}><Ionicons name="swap-vertical" size={20} color={t.onInk} /></Pressable>
          </View>
          <View accessible accessibilityLiveRegion="polite" accessibilityLabel={converted != null && rate ? `${formatMoney(converted, quote)}. ${formatRate(rate)}, ${updatedLabel(rate.asOf, now)}${rate.stale ? ", cached" : ""}` : rateError ?? "Finding the rate"} style={{ backgroundColor: t.surfaceTint, borderRadius: 14, padding: 16, gap: 4 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={{ fontSize: 12, fontFamily: t.font.bold, color: t.onTint, textTransform: "uppercase", letterSpacing: 0.6 }}>{quote} · {label(quote)}</Text><Text style={{ fontSize: 12, fontFamily: t.font.bold, color: t.onTint, textTransform: "uppercase" }}>{currencyName(quote)}</Text></View>
            <Text style={{ fontSize: 40, fontFamily: t.font.extrabold, color: t.onTint, letterSpacing: -0.8 }}>{converted != null ? formatMoney(converted, quote) : rateError ? "—" : "…"}</Text>
            {rate ? <Text style={{ fontSize: 12.5, fontFamily: t.font.semibold, color: t.onTint }}>{formatRate(rate)} · mid-market</Text> : rateError ? <Text style={{ fontSize: 12.5, fontFamily: t.font.semibold, color: t.danger }}>{rateError}</Text> : null}
            {rate ? <Text style={{ fontSize: 12, color: t.onTint, opacity: 0.85, fontFamily: t.font.regular }}>{updatedLabel(rate.asOf, now)}{rate.stale ? " · cached, may be out of date" : ""}</Text> : null}
          </View>
        </Animated.View>

        <Animated.View entering={enter(2)} accessibilityLabel="Quick amounts" style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {quickAmounts(base).map((a) => (
            <Button key={a} variant="secondary" size="sm" label={formatMoney(a, base)} accessibilityState={{ selected: amount === a && !adjust }} style={{ flexGrow: 1, flexBasis: "30%", paddingHorizontal: 8 }} onPress={() => { setDisplay(String(a)); setAdjust(null); }} />
          ))}
        </Animated.View>

        <Animated.View entering={enter(3)} accessibilityRole="radiogroup" accessibilityLabel="Trip currencies" style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          {chips.map((c) => {
            const on = quote === c.code;
            return (
              <View key={c.code} style={{ flexDirection: "row", alignItems: "center" }}>
                <Pressable accessibilityRole="radio" accessibilityLabel={c.primary ? c.code : c.label} accessibilityState={{ checked: on }} onPress={() => pickQuote(c.code)} style={{ height: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: on ? t.primary : t.borderStrong, backgroundColor: on ? t.primary : t.surface, justifyContent: "center" }}><Text style={{ fontSize: 13, fontFamily: t.font.bold, color: on ? t.onPrimary : t.text }}>{c.primary ? c.code : c.label}</Text></Pressable>
                {!c.primary && <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${c.code}`} onPress={() => remove(c.code)} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}><Ionicons name="trash-outline" size={14} color={t.textMuted} /></Pressable>}
              </View>
            );
          })}
          <Button variant="ghost" size="sm" label="Add currency" icon={<Ionicons name="add" size={16} color={t.primary} />} onPress={() => setAddOpen(true)} />
        </Animated.View>

        <Animated.View entering={enter(4)} accessibilityLabel="Keypad" style={{ gap: 8 }}>
          <View style={{ flexDirection: "row", gap: 8 }}>{key("1")}{key("2")}{key("3")}{accent("Tip", "Add a tip", () => setPicker((p) => (p === "tip" ? null : "tip")), { on: picker === "tip" })}</View>
          <View style={{ flexDirection: "row", gap: 8 }}>{key("4")}{key("5")}{key("6")}{accent("%", "Take a percentage off (tax-free, discounts)", () => setPicker((p) => (p === "off" ? null : "off")), { on: picker === "off" })}</View>
          <View style={{ flexDirection: "row", gap: 8 }}>{key("7")}{key("8")}{key("9")}{accent("", "Backspace", () => press("backspace"), { icon: "backspace-outline" })}</View>
          <View style={{ flexDirection: "row", gap: 8 }}>{key(".", "Decimal point")}{key("0")}{key("00", "Double zero")}{accent("Save", "Save this amount", save, { icon: "bookmark-outline", primary: true })}</View>
          {picker ? (
            <View accessibilityLabel={picker === "tip" ? "Tip presets" : "Percent off presets"} style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
              <Text style={{ fontSize: 12.5, fontFamily: t.font.bold, color: t.textMuted }}>{picker === "tip" ? "Tip" : "Off"}</Text>
              {(picker === "tip" ? TIP_PRESETS : [8, 10, 15, 20]).map((p) => <Button key={p} variant="secondary" size="sm" label={`${p}%`} accessibilityState={{ selected: adjust?.kind === picker && adjust.pct === p }} onPress={() => { setAdjust({ kind: picker, pct: p }); setPicker(null); }} />)}
              <Button variant="ghost" size="sm" label="None" onPress={() => { setAdjust(null); setPicker(null); }} />
            </View>
          ) : null}
        </Animated.View>

        {status ? <Text accessibilityLiveRegion="polite" style={{ fontSize: 13, fontFamily: t.font.semibold, color: t.primary }}>{status}</Text> : null}

        {common.length > 0 && local ? (
          <View style={{ gap: 8 }}>
            <Eyebrow>Common in {country ?? "the trip"}</Eyebrow>
            <Card>
              {common.map((p, i) => (
                <View key={p.label} accessible accessibilityLabel={`${p.label}: ${formatMoney(p.amount, local)}${commonRate != null && local !== home ? `, about ${formatMoney(convert(p.amount, commonRate, home), home)}` : ""}`} style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: i === common.length - 1 ? 0 : 1, borderBottomColor: t.border }}>
                  <Text style={{ fontSize: 14, fontFamily: t.font.semibold, color: t.text }}>{p.label}</Text>
                  <Text style={{ fontSize: 14, color: t.text }}><Text style={{ fontFamily: t.font.bold }}>{formatMoney(p.amount, local)}</Text>{commonRate != null && local !== home ? <Text style={{ color: t.textMuted }}> ≈ {formatMoney(convert(p.amount, commonRate, home), home)}</Text> : null}</Text>
                </View>
              ))}
            </Card>
          </View>
        ) : null}

        {saved.length > 0 && (
          <View style={{ gap: 8 }}>
            <Eyebrow>Saved on this device</Eyebrow>
            <Card>
              {saved.map((x, i) => (
                <View key={x.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: i === saved.length - 1 ? 0 : 1, borderBottomColor: t.border }}>
                  <Text style={{ fontSize: 14, color: t.text }}><Text style={{ fontFamily: t.font.bold }}>{formatMoney(x.amount, x.base)}</Text><Text style={{ color: t.textMuted }}> = {formatMoney(x.converted, x.quote)}</Text></Text>
                  <Pressable accessibilityRole="button" accessibilityLabel={`Remove saved ${formatMoney(x.amount, x.base)}`} onPress={() => persist(saved.filter((y) => y.id !== x.id))} style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}><Ionicons name="trash-outline" size={14} color={t.textMuted} /></Pressable>
                </View>
              ))}
            </Card>
          </View>
        )}
        <Text style={{ fontSize: 12, lineHeight: 16, color: t.textMuted, fontFamily: t.font.regular }}>Rates are mid-market and cached for offline use. Your card or the ATM will apply its own rate and fees.</Text>
      </ScrollView>

      <Modal visible={addOpen} transparent animationType="slide" onRequestClose={() => setAddOpen(false)} accessibilityViewIsModal>
        <Pressable accessibilityLabel="Cancel" accessibilityRole="button" onPress={() => setAddOpen(false)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }} />
        <View style={{ maxHeight: "75%", backgroundColor: t.canvas, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, paddingBottom: 36, gap: 12 }}>
          <Text accessibilityRole="header" style={{ fontSize: 18, fontFamily: t.font.extrabold, color: t.text }}>Add a currency</Text>
          <Text style={{ fontSize: 13, color: t.textMuted, fontFamily: t.font.regular }}>For a layover or a second country on this trip. Everyone on the trip sees it.</Text>
          <ScrollView style={{ maxHeight: 220 }}>
            <Card>
              <View accessibilityRole="radiogroup" accessibilityLabel="Currency">
                {ADD_OPTIONS.filter((c) => c !== home && c !== local).map((c, i, arr) => {
                  const on = addCode === c;
                  return (
                    <Pressable key={c} accessibilityRole="radio" accessibilityLabel={`${c}, ${currencyName(c)}`} accessibilityState={{ checked: on }} onPress={() => setAddCode(c)} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, minHeight: 48, backgroundColor: on ? t.surfaceTint : "transparent", borderBottomWidth: i === arr.length - 1 ? 0 : 1, borderBottomColor: t.border }}>
                      <Text style={{ width: 44, fontSize: 15, fontFamily: t.font.bold, color: t.text }}>{c}</Text><Text style={{ flex: 1, fontSize: 13, color: t.textMuted, fontFamily: t.font.regular }}>{currencyName(c)}</Text>{on && <Ionicons name="checkmark" size={18} color={t.primary} />}
                    </Pressable>
                  );
                })}
              </View>
            </Card>
          </ScrollView>
          <TextInput accessibilityLabel="Note (optional)" value={addLabel} onChangeText={setAddLabel} maxLength={60} placeholder="Seoul layover" placeholderTextColor={t.textFaint} style={{ height: 44, borderWidth: 1, borderColor: t.borderStrong, borderRadius: 10, paddingHorizontal: 12, color: t.text, fontFamily: t.font.regular, backgroundColor: t.surface }} />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button variant="secondary" label="Cancel" style={{ flex: 1 }} onPress={() => setAddOpen(false)} />
            <Button label="Add" style={{ flex: 1 }} onPress={submitAdd} />
          </View>
        </View>
      </Modal>
    </View>
  );
}
