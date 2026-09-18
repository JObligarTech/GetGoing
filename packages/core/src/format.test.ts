import { describe, expect, it } from "vitest";
import { DEMO_NOW } from "./demo";
import { formatClock, formatDateRange, formatDayHeading, formatMoney, formatTime, greeting, tzOffsetLabel } from "./format";

describe("format", () => {
  it("date ranges like the mockups", () => {
    expect(formatDateRange("2027-03-15", "2027-03-29")).toBe("Mar 15–29");
    expect(formatDateRange("2026-06-03", "2026-06-10")).toBe("Jun 3–10");
    expect(formatDateRange("2027-03-28", "2027-04-02")).toBe("Mar 28 – Apr 2");
    expect(formatDateRange(null, null)).toBe("No dates yet");
  });
  it("day heading", () => {
    // 2027-03-15 is a Monday (the mockup's "Sat" was illustrative).
    expect(formatDayHeading("2027-03-15")).toBe("Mon, Mar 15");
    expect(formatDayHeading("2027-03-20")).toBe("Sat, Mar 20");
  });
  it("clock + time zones", () => {
    expect(formatClock("09:00")).toBe("9:00 AM");
    expect(formatTime(DEMO_NOW, "Asia/Tokyo")).toBe("2:41 PM");
    expect(tzOffsetLabel(DEMO_NOW, "Asia/Tokyo", "America/Los_Angeles")).toBe("+17h");
    expect(tzOffsetLabel(DEMO_NOW, "Asia/Kolkata", "UTC")).toBe("+5:30");
  });
  it("money", () => {
    expect(formatMoney(1200, "JPY")).toBe("¥1,200");
    expect(formatMoney(6.68, "USD")).toBe("$6.68");
  });
  it("greeting by local hour", () => {
    expect(greeting(new Date("2027-03-15T00:00:00Z"), "Asia/Tokyo")).toBe("Good morning");
    expect(greeting(new Date("2027-03-15T12:00:00Z"), "Asia/Tokyo")).toBe("Good evening");
  });
});
