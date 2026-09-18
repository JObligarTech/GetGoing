"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Chip, IconCoin } from "@/components/ui/primitives";
import { Avatars } from "@/components/navigate/tree/Avatars";

interface Person { id: string; name: string; color: string }

/**
 * "Send my location": reads the device position once, builds an OpenStreetMap link and
 * hands it to the OS share sheet (or the clipboard). Nothing is stored or sent to Voya's
 * backend — the message goes wherever the traveler chooses to send it.
 */
export function SendLocation({ travelers, senderName, tz }: { travelers: Person[]; senderName: string; tz: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState<string[]>(() => travelers.map((t) => t.id));
  const [status, setStatus] = useState<{ text?: string; error?: string; busy?: boolean }>({});
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) { d.showModal(); d.querySelector<HTMLElement>("input, button")?.focus(); }
    if (!open && d.open) d.close();
  }, [open]);

  const send = () => {
    if (!("geolocation" in navigator)) { setStatus({ error: "This device can't share its location." }); return; }
    setStatus({ busy: true });
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const at = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(new Date());
        const names = travelers.filter((t) => to.includes(t.id)).map((t) => t.name.split(" ")[0]);
        const url = `https://www.openstreetmap.org/?mlat=${lat.toFixed(5)}&mlon=${lng.toFixed(5)}#map=17/${lat.toFixed(5)}/${lng.toFixed(5)}`;
        const text = `${senderName} is here (${at}): ${url}`;
        try {
          if (navigator.share) { await navigator.share({ text }); setStatus({ text: `Shared with ${names.join(", ") || "your travelers"}.` }); }
          else { await navigator.clipboard.writeText(text); setStatus({ text: `Location link copied — paste it to ${names.join(", ") || "your travelers"}.` }); }
        } catch { setStatus({}); }
      },
      (err) => setStatus({ error: err.code === err.PERMISSION_DENIED ? "Location permission was denied. Allow it in your browser to share where you are." : "Couldn't get your location right now." }),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors duration-(--dur-fast) hover:bg-tint/60">
        <IconCoin><Send size={20} /></IconCoin>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">Send my location</span>
          <span className="block truncate text-[12px] text-muted">to {travelers.map((t) => t.name.split(" ")[0]).join(", ") || "your travelers"}</span>
        </span>
        <Chip>Live</Chip>
      </button>
      <dialog ref={ref} onClose={() => setOpen(false)} aria-labelledby={id} className="m-auto w-[min(92vw,440px)] rounded-2xl border border-line bg-surface p-0 text-ink shadow-card backdrop:bg-black/50">
        <div className="flex flex-col gap-3 p-4">
          <h2 id={id} className="text-[18px] font-extrabold">Send my location</h2>
          <p className="text-[13px] text-muted">Voya reads your position once and opens your share sheet with a map link. It isn&apos;t stored.</p>
          <fieldset className="card divide-y divide-line">
            <legend className="sr-only">Who to send it to</legend>
            {travelers.map((t) => (
              <label key={t.id} className="flex h-12 cursor-pointer items-center gap-3 px-3.5">
                <input type="checkbox" checked={to.includes(t.id)} onChange={(e) => setTo((v) => (e.target.checked ? [...v, t.id] : v.filter((x) => x !== t.id)))} className="h-5 w-5 accent-[#2F5D3A]" />
                <Avatars travelers={[t]} />
                <span className="text-[14px] font-semibold">{t.name}</span>
              </label>
            ))}
            {travelers.length === 0 && <p className="px-3.5 py-3 text-[13px] text-muted">Add travelers in People to pick recipients; the link still shares.</p>}
          </fieldset>
          {status.error && <p role="alert" className="text-[13px] font-semibold text-danger">{status.error}</p>}
          <p role="status" className={status.text ? "text-[13px] font-semibold text-primary" : "sr-only"}>{status.text ?? ""}</p>
          <div className="flex gap-2">
            <Button variant="secondary" full onClick={() => setOpen(false)}>Close</Button>
            <Button full icon={<Send size={16} />} onClick={send} loading={status.busy}>Share my location</Button>
          </div>
        </div>
      </dialog>
    </>
  );
}
