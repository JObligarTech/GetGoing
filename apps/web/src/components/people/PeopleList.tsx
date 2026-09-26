"use client";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Link2, Pencil, Plus, Send, Trash2, UserPlus } from "lucide-react";
import { formatDateRange, inviteText, joiningLabel, travelerDetail, travelerKind, type TravelerGroup, type TravelerRow, type TripRow } from "@voya/core";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Form";
import { Card, Chip, ListRow, SectionHeader, Tile } from "@/components/ui/primitives";
import { Avatars } from "@/components/navigate/tree/Avatars";
import { cx } from "@/lib/utils";

export interface PeopleListProps {
  trip: Pick<TripRow, "id" | "name" | "owner_id" | "start_date" | "end_date" | "cities">;
  travelers: TravelerRow[];
  groups: TravelerGroup[];
  userId: string;
  userFirstName: string;
  homeCurrency: string;
  pendingInvites: string[];
  addAction: (input: unknown) => Promise<TravelerRow | { error: string }>;
  updateAction: (id: unknown, input: unknown) => Promise<TravelerRow | { error: string }>;
  removeAction: (tripId: unknown, id: unknown) => Promise<{ ok: true } | { error: string }>;
  inviteAction: (tripId: unknown, travelerId: unknown) => Promise<{ url: string; expiresAt: string } | { error: string }>;
}

type Draft = { id: string | null; name: string; contact: string; homeCurrency: string; joining: "whole" | "dates"; joiningStart: string; joiningEnd: string; joiningNote: string };
const empty = (): Draft => ({ id: null, name: "", contact: "", homeCurrency: "", joining: "whole", joiningStart: "", joiningEnd: "", joiningNote: "" });

/**
 * People (mockup 2c): everyone on the trip with how they show up, guests with an Invite
 * link, and the groups tree routes created. Add / edit is a dialog: a name is enough.
 */
export function PeopleList({ trip, travelers: initial, groups, userId, userFirstName, homeCurrency, pendingInvites, addAction, updateAction, removeAction, inviteAction }: PeopleListProps) {
  const [travelers, setTravelers] = useState(initial);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [invited, setInvited] = useState<string[]>(pendingInvites);
  const [pending, start] = useTransition();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = dialog.current; if (!d) return;
    if (draft && !d.open) { d.showModal(); d.querySelector<HTMLElement>("input")?.focus(); }
    if (!draft && d.open) d.close();
  }, [draft]);

  const edit = (t: TravelerRow) => setDraft({ id: t.id, name: t.name, contact: t.email ?? t.phone ?? "", homeCurrency: t.home_currency ?? "", joining: t.joining_start || t.joining_end ? "dates" : "whole", joiningStart: t.joining_start ?? "", joiningEnd: t.joining_end ?? "", joiningNote: t.joining_note ?? "" });
  const submit = (fd: FormData) => {
    if (!draft) return;
    const contact = String(fd.get("contact") ?? "").trim();
    const input = {
      tripId: trip.id, name: fd.get("name"), email: contact.includes("@") ? contact : null, phone: contact && !contact.includes("@") ? contact : null,
      homeCurrency: String(fd.get("homeCurrency") ?? "").trim().toUpperCase() || null,
      joiningStart: fd.get("joining") === "dates" ? String(fd.get("joiningStart") || "") || null : null,
      joiningEnd: fd.get("joining") === "dates" ? String(fd.get("joiningEnd") || "") || null : null,
      joiningNote: fd.get("joining") === "dates" ? String(fd.get("joiningNote") || "").trim() || null : null,
    };
    start(async () => {
      const r = draft.id ? await updateAction(draft.id, input) : await addAction(input);
      if ("error" in r) { setError(r.error); return; }
      setError(null);
      setTravelers((list) => (draft.id ? list.map((t) => (t.id === r.id ? r : t)) : [...list, r]));
      setStatus(draft.id ? `Saved ${r.name}.` : `Added ${r.name} to ${trip.name}.`);
      setDraft(null);
    });
  };
  const remove = (t: TravelerRow) => start(async () => {
    const r = await removeAction(trip.id, t.id);
    if ("error" in r) { setError(r.error); return; }
    setTravelers((list) => list.filter((x) => x.id !== t.id));
    setStatus(`Removed ${t.name}.`); setDraft(null);
  });
  const invite = (t: TravelerRow) => start(async () => {
    const r = await inviteAction(trip.id, t.id);
    if ("error" in r) { setError(r.error); return; }
    const text = inviteText(trip.name, userFirstName, r.url);
    try {
      if (navigator.share) { await navigator.share({ text }); setStatus(`Invite for ${t.name.split(" ")[0]} shared.`); }
      else { await navigator.clipboard.writeText(text); setStatus(`Invite link for ${t.name.split(" ")[0]} copied. It works for 30 days.`); }
      setInvited((v) => (v.includes(t.id) ? v : [...v, t.id]));
    } catch { setStatus(""); }
  });

  return (
    <div className="flex flex-col gap-3.5">
      <Card className="divide-y divide-line">
        {travelers.map((t) => {
          const kind = travelerKind(t, userId);
          return (
            <div key={t.id} className="flex items-center gap-3 px-3.5 py-3">
              <Tile name={t.name} size={40} radius={999} color={t.color} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold">{t.name}</p>
                <p className="truncate text-[12px] text-muted">{travelerDetail(t, trip, userId, homeCurrency)}</p>
              </div>
              {kind === "guest" && (
                <Button variant={invited.includes(t.id) ? "secondary" : "ghost"} size="sm" icon={invited.includes(t.id) ? <Link2 size={16} /> : <Send size={16} />} onClick={() => invite(t)} loading={pending} aria-label={`${invited.includes(t.id) ? "Share invite link again for" : "Invite"} ${t.name}`}>
                  {invited.includes(t.id) ? "Link" : "Invite"}
                </Button>
              )}
              {kind !== "you" && <button type="button" onClick={() => edit(t)} aria-label={`Edit ${t.name}`} className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-tint hover:text-ink"><Pencil size={16} aria-hidden="true" /></button>}
            </div>
          );
        })}
        <ListRow onClick={() => { setError(null); setDraft(empty()); }} leading={<span aria-hidden="true" className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-tint text-primary"><UserPlus size={18} /></span>} title="Add traveler" subtitle="A name is enough · no account needed" ariaLabel="Add traveler" />
      </Card>
      <p className="text-[12.5px] leading-snug text-muted">Guests don&apos;t need a Voya account. They show up in Split, get routes and locations by link, and can join later to see the whole trip.</p>
      {error && <p role="alert" className="rounded-lg border border-danger/40 bg-danger/10 px-3.5 py-2.5 text-[13px] font-semibold text-danger">{error}</p>}
      <p role="status" className={status ? "text-[13px] font-semibold text-primary" : "sr-only"}>{status}</p>

      <SectionHeader title="Groups" />
      {groups.length ? (
        <Card className="divide-y divide-line">
          {groups.map((g) => (
            <div key={g.branch.id} className="flex items-center gap-3 px-3.5 py-3">
              <span aria-hidden="true" className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ background: g.branch.color }} />
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold">{g.branch.name}</p>
                <p className="truncate text-[12px] text-muted">Used in &ldquo;{g.routeName}&rdquo; route</p>
              </div>
              <Avatars travelers={g.travelers.map((t) => ({ id: t.id, name: t.name, color: t.color }))} size={26} />
            </div>
          ))}
        </Card>
      ) : (
        <p className="text-[13px] text-muted">Groups appear here when you split a tree route in Navigate.</p>
      )}

      <dialog ref={dialog} onClose={() => setDraft(null)} aria-labelledby={titleId} className="m-auto w-[min(92vw,460px)] rounded-2xl border border-line bg-surface p-0 text-ink shadow-card backdrop:bg-black/50">
        {draft && (
          <form action={submit} className="flex flex-col gap-3 p-4" noValidate>
            <h2 id={titleId} className="text-[18px] font-extrabold">{draft.id ? "Edit traveler" : "Add traveler"}</h2>
            <Field label="Name" name="name" required maxLength={80} defaultValue={draft.name} placeholder="Maya Chen" />
            <Field label="Email or phone (optional)" name="contact" maxLength={254} defaultValue={draft.contact} hint="Only used for the invite text. Never shown to other guests." />
            <Field label="Home currency (optional)" name="homeCurrency" maxLength={3} defaultValue={draft.homeCurrency} placeholder="CAD" hint="Split shows their share in it." />
            <fieldset className="flex flex-col gap-2">
              <legend className="text-[13px] font-semibold">Joining for</legend>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Joining for">
                {([["whole", "Whole trip"], ["dates", "Some days"]] as const).map(([v, label]) => (
                  <label key={v} className={cx("inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-[13px] font-bold", draft.joining === v ? "border-primary bg-primary text-on-primary" : "border-line-strong bg-surface")}>
                    <input type="radio" name="joining" value={v} checked={draft.joining === v} onChange={() => setDraft({ ...draft, joining: v })} className="sr-only" />{label}
                  </label>
                ))}
              </div>
              {draft.joining === "dates" && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="From" name="joiningStart" type="date" defaultValue={draft.joiningStart || trip.start_date || ""} min={trip.start_date ?? undefined} max={trip.end_date ?? undefined} />
                  <Field label="To" name="joiningEnd" type="date" defaultValue={draft.joiningEnd || trip.end_date || ""} min={trip.start_date ?? undefined} max={trip.end_date ?? undefined} />
                  <div className="col-span-2"><Field label="Where (optional)" name="joiningNote" maxLength={80} defaultValue={draft.joiningNote} placeholder={trip.cities[0] ? `${trip.cities[0]} only` : "Tokyo only"} /></div>
                </div>
              )}
              {draft.joining === "whole" && trip.start_date && <p className="text-[12px] text-muted">{formatDateRange(trip.start_date, trip.end_date)} · {joiningLabel({ joining_start: null, joining_end: null, joining_note: null }, trip)}</p>}
            </fieldset>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button type="submit" full loading={pending} icon={draft.id ? undefined : <Plus size={16} />}>{draft.id ? "Save" : `Add to ${trip.name}`}</Button>
              <Button type="button" variant="secondary" onClick={() => setDraft(null)}>Cancel</Button>
              {draft.id && !travelers.find((t) => t.id === draft.id)?.user_id && (
                <Button type="button" variant="danger" icon={<Trash2 size={16} />} onClick={() => { const t = travelers.find((x) => x.id === draft.id); if (t) remove(t); }}>Remove</Button>
              )}
            </div>
            <Chip tone="plain" className="self-start">Trip of {formatDateRange(trip.start_date, trip.end_date)}</Chip>
          </form>
        )}
      </dialog>
    </div>
  );
}
