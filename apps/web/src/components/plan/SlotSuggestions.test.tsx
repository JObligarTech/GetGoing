import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { demoBundle } from "@voya/core";
import { OpenSlot } from "./SlotSuggestions";
import { expectNoA11yViolations } from "@/test/a11y";

describe("OpenSlot", () => {
  it("opens a labelled dialog listing suggestions with an Add action", async () => {
    const action = vi.fn(async () => {});
    const place = demoBundle.places[5]!;
    const { container } = render(
      <OpenSlot time="13:00" title="Harajuku lunch" tripId={demoBundle.trip.id} itemId="i3" day="2027-03-15" action={action}
        suggestions={[{ place, fromName: "Meiji Jingu", minutes: 21, color: "#E0A020", category: "Coffee" }]} />,
    );
    const trigger = screen.getByRole("button", { name: /Harajuku lunch/ });
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    await userEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Fill the 13:00 slot" });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cafe Kitsuné.*21 min from Meiji Jingu.*Add/ })).toHaveAttribute("value", place.id);
    await expectNoA11yViolations(container);
  });
});
