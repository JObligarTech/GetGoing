import { describe, expect, it } from "vitest";
import { DEMO_USER_ID, demoBundle } from "./demo";
import { inviteText, joiningLabel, nextTravelerColor, travelerDetail, travelerGroups, travelerStatus } from "./people";

const trip = demoBundle.trip;

describe("people", () => {
  it("describes each traveler like the mockup", () => {
    const [joe, chris, daniel, sarah] = demoBundle.travelers;
    expect(travelerStatus(joe!, trip, DEMO_USER_ID)).toBe("You · Organizer");
    expect(travelerStatus(chris!, trip, DEMO_USER_ID)).toBe("Guest");
    expect(travelerDetail(joe!, trip, DEMO_USER_ID, "USD")).toBe("You · Organizer · All 14 nights · Home USD");
    expect(travelerDetail(daniel!, trip, DEMO_USER_ID)).toBe("Guest · Tokyo only, Mar 15–20 · Home CAD");
    expect(travelerDetail(sarah!, trip, DEMO_USER_ID)).toBe("Guest · All 14 nights · +1 415 555 0142");
    expect(travelerDetail(chris!, trip, DEMO_USER_ID)).toBe("Guest · All 14 nights · chris@example.com");
    expect(joiningLabel({ joining_start: "2027-03-18", joining_end: null, joining_note: null }, trip)).toBe("Mar 18–29");
    expect(joiningLabel({ joining_start: null, joining_end: null, joining_note: null }, { start_date: null, end_date: null })).toBe("Whole trip");
  });
  it("lists groups from tree routes", () => {
    const g = travelerGroups(demoBundle);
    expect(g.map((x) => [x.branch.name, x.routeName, x.travelers.map((t) => t.name.split(" ")[0])])).toEqual([["Group A", "Shibuya afternoon", ["Joe", "Sarah"]], ["Group B", "Shibuya afternoon", ["Chris", "Daniel"]]]);
  });
  it("picks an unused colour and writes the invite", () => {
    expect(nextTravelerColor(demoBundle.travelers)).toBe("#E0A020");
    expect(inviteText("Japan 2027", "Joe", "https://voya.app/join/abc")).toContain('Joe added you to "Japan 2027"');
  });
});
