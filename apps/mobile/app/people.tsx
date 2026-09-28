import { useState } from "react";
import { Modal, Pressable, ScrollView, Share, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { formatDateRange, initial, inviteText, travelerDetail, travelerGroups, travelerKind, type TravelerRow, giftStatusLabel, markForUser } from "@voya/core";
import { Button, Card, Chip, EmptyState, Eyebrow, IconCoin, ListRow, announce, screenStyles } from "@/components/ui";
import { Avatar } from "@/components/pass";
import { useData } from "@/lib/data";
import { useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme";

type Draft = { id: string | null; name: string; contact: string; homeCurrency: string; joining: "whole" | "dates"; joiningStart: string; joiningEnd: string; joiningNote: string };
const empty = (): Draft => ({ id: null, name: "", contact: "", homeCurrency: "", joining: "whole", joiningStart: "", joiningEnd: "", joiningNote: "" });

/**
 * People (mockup 2c): everyone on the trip with how they show up, Invite for guests, and
 * the groups tree routes created. Add / edit is a sheet: a name is enough.
 */
export default function PeopleScreen() {
  const t = useTheme();
  const s = screenStyles(t);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useSession();
  const { now, active, bundle, addTraveler, updateTraveler, removeTraveler, createInvite } = useData();
  const giftNote = (travelerId: string) => { const g = bundle?.passGifts.find((x) => x.traveler_id === travelerId); return g ? ` · ${giftStatusLabel(g, bundle!.travelers.find((x) => x.id === travelerId)?.name.split(" ")[0] ?? "them", now)}` : ""; };
  const [draft, setDraft] = useState<Draft | null>(null);
  const [status, setStatus] = useState<{ ok?: string; error?: string }>({});
  const [busy, setBusy] = useState(false);
  if (!user || !active || !bundle) return <View style={s.screen}><View style={[s.content, { paddingTop: insets.top + 8 }]}><EmptyState title="No active trip" action={<Button label="Back" variant="secondary" onPress={() => router.back()} />} /></View></View>;
  const trip = bundle.trip;
  const groups = travelerGroups(bundle);
  const invited = new Set(bundle.tripInvites.filter((i) => i.traveler_id && !i.accepted_at).map((i) => i.traveler_id!));

  const edit = (tr: TravelerRow) => setDraft({ id: tr.id, name: tr.name, contact: tr.email ?? tr.phone ?? "", homeCurrency: tr.home_currency ?? "", joining: tr.joining_start || tr.joining_end ? "dates" : "whole", joiningStart: tr.joining_start ?? "", joiningEnd: tr.joining_end ?? "", joiningNote: tr.joining_note ?? "" });
  const submit = async () => {
    if (!draft) return;
    const contact = draft.contact.trim();
    const input = {
      name: draft.name, email: contact.includes("@") ? contact : null, phone: contact && !contact.includes("@") ? contact : null, homeCurrency: draft.homeCurrency.trim().toUpperCase() || null,
      joiningStart: draft.joining === "dates" ? draft.joiningStart || null : null, joiningEnd: draft.joining === "dates" ? draft.joiningEnd || null : null, joiningNote: draft.joining === "dates" ? draft.joiningNote.trim() || null : null,
    };
    setBusy(true);
    const r = draft.id ? await updateTraveler(draft.id, input) : await addTraveler(input);
    setBusy(false);
    if ("error" in r) { setStatus({ error: r.error }); announce(r.error); return; }
    const ok = draft.id ? `Saved ${r.name}.` : `Added ${r.name} to ${trip.name}.`;
    setStatus({ ok }); announce(ok); setDraft(null);
  };
  const remove = async (id: string) => {
    const tr = bundle.travelers.find((x) => x.id === id);
    const r = await removeTraveler(id);
    if ("error" in r) { setStatus({ error: r.error }); return; }
    const ok = `Removed ${tr?.name ?? "traveler"}.`; setStatus({ ok }); announce(ok); setDraft(null);
  };
  const invite = async (tr: TravelerRow) => {
    const r = await createInvite(tr.id);
    if ("error" in r) { setStatus({ error: r.error }); announce(r.error); return; }
    try {
      const res = await Share.share({ message: inviteText(trip.name, user.profile.display_name.split(" ")[0] ?? "A traveler", r.url) });
      const ok = res.action === Share.sharedAction ? `Invite for ${tr.name.split(" ")[0]} shared. It works for 30 days.` : "";
      setStatus({ ok }); if (ok) announce(ok);
    } catch { setStatus({}); }
  };
  const field = (label: string, key: keyof Draft, opts: { placeholder?: string; hint?: string; maxLength?: number; autoCapitalize?: "characters" | "words" } = {}) => (
    <View style={{ gap: 4 }}>
      <Text style={{ fontSize: 13, fontFamily: t.font.semibold, color: t.text }}>{label}</Text>
      <TextInput accessibilityLabel={label} value={String(draft?.[key] ?? "")} onChangeText={(v) => setDraft((d) => (d ? { ...d, [key]: v } : d))} placeholder={opts.placeholder} placeholderTextColor={t.textFaint} maxLength={opts.maxLength ?? 80} autoCapitalize={opts.autoCapitalize ?? "words"} style={{ height: 44, borderWidth: 1, borderColor: t.borderStrong, borderRadius: 10, paddingHorizontal: 12, color: t.text, fontFamily: t.font.regular, backgroundColor: t.surface }} />
      {opts.hint ? <Text style={{ fontSize: 12, color: t.textMuted, fontFamily: t.font.regular }}>{opts.hint}</Text> : null}
    </View>
  );

  return (
    <View style={s.screen}>
      <ScrollView contentContainerStyle={[s.content, { paddingTop: insets.top + 8 }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Back to ${trip.name}`} onPress={() => router.back()} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: t.borderStrong, backgroundColor: t.surface, alignItems: "center", justifyContent: "center" }}><Ionicons name="arrow-back" size={20} color={t.text} /></Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, color: t.textMuted, fontFamily: t.font.medium }}>{trip.name}</Text>
            <Text accessibilityRole="header" style={{ fontSize: 26, fontFamily: t.font.extrabold, color: t.text, letterSpacing: -0.5 }}>People · {bundle.travelers.length}</Text>
          </View>
          <Button size="sm" label="Add" icon={<Ionicons name="add" size={16} color={t.onPrimary} />} onPress={() => { setStatus({}); setDraft(empty()); }} />
        </View>

        <Card>
          {bundle.travelers.map((tr, i) => {
            const kind = travelerKind(tr, user.id);
            return (
              <View key={tr.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.border }} accessible accessibilityLabel={`${tr.name}, ${travelerDetail(tr, trip, user.id, user.profile.home_currency)}${giftNote(tr.id)}${markForUser(bundle.passMarks, tr.user_id) ? ", Atlas Premium Pass" : ""}`}>
                <Avatar name={tr.name} size={40} color={tr.color} mark={markForUser(bundle.passMarks, tr.user_id)} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ fontSize: 15, fontFamily: t.font.semibold, color: t.text }}>{tr.name}</Text>
                  <Text numberOfLines={1} style={{ fontSize: 12, color: t.textMuted, fontFamily: t.font.regular }}>{travelerDetail(tr, trip, user.id, user.profile.home_currency)}{giftNote(tr.id)}</Text>
                </View>
                {kind === "guest" && <Button variant={invited.has(tr.id) ? "secondary" : "ghost"} size="sm" label={invited.has(tr.id) ? "Link" : "Invite"} accessibilityLabel={`${invited.has(tr.id) ? "Share invite link again for" : "Invite"} ${tr.name}`} onPress={() => invite(tr)} />}
                {kind !== "you" && <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${tr.name}`} onPress={() => edit(tr)} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}><Ionicons name="pencil-outline" size={16} color={t.textMuted} /></Pressable>}
                {i === bundle.travelers.length - 1 ? null : null}
              </View>
            );
          })}
          <ListRow onPress={() => { setStatus({}); setDraft(empty()); }} leading={<IconCoin name="person-add-outline" />} title="Add traveler" subtitle="A name is enough · no account needed" accessibilityLabel="Add traveler" last />
        </Card>
        <Text style={{ fontSize: 12.5, lineHeight: 17, color: t.textMuted, fontFamily: t.font.regular }}>Guests don&apos;t need a Get Going account. They show up in Split, get routes and locations by link, and can join later to see the whole trip.</Text>
        {status.error ? <Text accessibilityRole="alert" style={{ color: t.danger, fontSize: 13, fontFamily: t.font.semibold }}>{status.error}</Text> : null}
        {status.ok ? <Text accessibilityLiveRegion="polite" style={{ color: t.primary, fontSize: 13, fontFamily: t.font.semibold }}>{status.ok}</Text> : null}

        <Eyebrow>Groups</Eyebrow>
        {groups.length ? (
          <Card>
            {groups.map((g, i) => (
              <View key={g.branch.id} accessible accessibilityLabel={`${g.branch.name}: ${g.travelers.map((x) => x.name.split(" ")[0]).join(", ")}. Used in ${g.routeName} route`} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: i === groups.length - 1 ? 0 : 1, borderBottomColor: t.border }}>
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: g.branch.color }} />
                <View style={{ flex: 1 }}><Text style={{ fontSize: 15, fontFamily: t.font.semibold, color: t.text }}>{g.branch.name}</Text><Text style={{ fontSize: 12, color: t.textMuted, fontFamily: t.font.regular }}>Used in &ldquo;{g.routeName}&rdquo; route</Text></View>
                <View style={{ flexDirection: "row" }}>{g.travelers.map((x, n) => <View key={x.id} style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: x.color, borderWidth: 2, borderColor: t.surface, marginLeft: n ? -8 : 0, alignItems: "center", justifyContent: "center" }}><Text style={{ color: "#fff", fontSize: 10, fontFamily: t.font.bold }}>{initial(x.name)}</Text></View>)}</View>
              </View>
            ))}
          </Card>
        ) : <Text style={{ fontSize: 13, color: t.textMuted, fontFamily: t.font.regular }}>Groups appear here when you split a tree route in Navigate.</Text>}
      </ScrollView>

      <Modal visible={!!draft} transparent animationType="slide" onRequestClose={() => setDraft(null)} accessibilityViewIsModal>
        <Pressable accessibilityLabel="Cancel" accessibilityRole="button" onPress={() => setDraft(null)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }} />
        {draft && (
          <ScrollView style={{ maxHeight: "85%", backgroundColor: t.canvas, borderTopLeftRadius: 20, borderTopRightRadius: 20 }} contentContainerStyle={{ padding: 16, paddingBottom: 36, gap: 12 }} keyboardShouldPersistTaps="handled">
            <Text accessibilityRole="header" style={{ fontSize: 18, fontFamily: t.font.extrabold, color: t.text }}>{draft.id ? "Edit traveler" : "Add traveler"}</Text>
            {field("Name", "name", { placeholder: "Maya Chen" })}
            {field("Email or phone (optional)", "contact", { maxLength: 254, hint: "Only used for the invite text. Never shown to other guests.", autoCapitalize: "words" })}
            {field("Home currency (optional)", "homeCurrency", { placeholder: "CAD", maxLength: 3, hint: "Split shows their share in it.", autoCapitalize: "characters" })}
            <Text style={{ fontSize: 13, fontFamily: t.font.semibold, color: t.text }}>Joining for</Text>
            <View accessibilityRole="radiogroup" accessibilityLabel="Joining for" style={{ flexDirection: "row", gap: 8 }}>
              {([["whole", "Whole trip"], ["dates", "Some days"]] as const).map(([v, label]) => {
                const on = draft.joining === v;
                return <Pressable key={v} accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ checked: on }} onPress={() => setDraft({ ...draft, joining: v, joiningStart: draft.joiningStart || trip.start_date || "", joiningEnd: draft.joiningEnd || trip.end_date || "" })} style={{ height: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: on ? t.primary : t.borderStrong, backgroundColor: on ? t.primary : t.surface, justifyContent: "center" }}><Text style={{ fontSize: 13, fontFamily: t.font.bold, color: on ? t.onPrimary : t.text }}>{label}</Text></Pressable>;
              })}
            </View>
            {draft.joining === "dates" ? (
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: "row", gap: 8 }}><View style={{ flex: 1 }}>{field("From", "joiningStart", { placeholder: "2027-03-15", maxLength: 10, autoCapitalize: "characters" })}</View><View style={{ flex: 1 }}>{field("To", "joiningEnd", { placeholder: "2027-03-20", maxLength: 10, autoCapitalize: "characters" })}</View></View>
                {field("Where (optional)", "joiningNote", { placeholder: trip.cities[0] ? `${trip.cities[0]} only` : "Tokyo only" })}
              </View>
            ) : trip.start_date ? <Chip tone="plain">{formatDateRange(trip.start_date, trip.end_date)}</Chip> : null}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Button label={draft.id ? "Save" : `Add to ${trip.name}`} style={{ flexGrow: 1 }} onPress={submit} disabled={busy || !draft.name.trim()} />
              <Button variant="secondary" label="Cancel" onPress={() => setDraft(null)} />
              {draft.id && !bundle.travelers.find((x) => x.id === draft.id)?.user_id ? <Button variant="secondary" label="Remove" accessibilityLabel={`Remove ${draft.name}`} onPress={() => remove(draft.id!)} /> : null}
            </View>
          </ScrollView>
        )}
      </Modal>
    </View>
  );
}
