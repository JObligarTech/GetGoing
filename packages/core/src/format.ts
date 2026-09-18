/** Locale-aware formatting helpers used identically on web and native. */

export function formatMoney(amount: number, currency: string, locale = "en-US"): string {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: currency === "JPY" ? 0 : 2 }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function formatTime(at: Date, tz: string, locale = "en-US"): string {
  return new Intl.DateTimeFormat(locale, { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(at);
}

/** "+14h" / "-3h" / "+5:30" offset of `tz` relative to `homeTz` at a moment. */
export function tzOffsetLabel(at: Date, tz: string, homeTz: string): string {
  const mins = (z: string) => {
    const p = new Intl.DateTimeFormat("en-US", { timeZone: z, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(at);
    const g = (t: string) => Number(p.find((x) => x.type === t)?.value);
    return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour") % 24, g("minute")) / 60000;
  };
  const diff = Math.round(mins(tz) - mins(homeTz));
  const sign = diff >= 0 ? "+" : "-";
  const abs = Math.abs(diff);
  const h = Math.floor(abs / 60), m = abs % 60;
  return m ? `${sign}${h}:${String(m).padStart(2, "0")}` : `${sign}${h}h`;
}

/** "Mar 15–29" / "Mar 15 – Apr 2" / "No dates yet". */
export function formatDateRange(start: string | null, end: string | null, locale = "en-US"): string {
  if (!start) return "No dates yet";
  const s = new Date(`${start}T00:00:00Z`);
  const e = end ? new Date(`${end}T00:00:00Z`) : null;
  const md = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: "UTC" });
  const d = new Intl.DateTimeFormat(locale, { day: "numeric", timeZone: "UTC" });
  if (!e) return md.format(s);
  if (s.getUTCMonth() === e.getUTCMonth() && s.getUTCFullYear() === e.getUTCFullYear()) return `${md.format(s)}–${d.format(e)}`;
  return `${md.format(s)} – ${md.format(e)}`;
}

/** "Sat, Mar 15" */
export function formatDayHeading(date: string, locale = "en-US"): string {
  return new Intl.DateTimeFormat(locale, { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

/** "09:00" → "9:00 AM" */
export function formatClock(hhmm: string | null, locale = "en-US"): string {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  return new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", timeZone: "UTC" }).format(new Date(Date.UTC(2000, 0, 1, h, m)));
}

export function greeting(at: Date, tz: string): string {
  const h = Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hour12: false }).format(at)) % 24;
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function pluralize(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
