import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { demoTrips } from "@voya/core";
import { TripSwitcher } from "./TripSwitcher";
import { expectNoA11yViolations } from "@/test/a11y";

describe("TripSwitcher", () => {
  it("is a menu button; opens a menu with the active trip checked; Esc closes and restores focus", async () => {
    const action = vi.fn(async () => {});
    const { container } = render(<TripSwitcher trips={demoTrips} activeId={demoTrips[0]!.id} action={action} back="/home" />);
    const btn = screen.getByRole("button", { name: /Japan 2027, switch trip/ });
    expect(btn).toHaveAttribute("aria-haspopup", "menu");
    expect(btn).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "true");
    const items = screen.getAllByRole("menuitemradio");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveAttribute("aria-checked", "true");
    expect(items[0]).toHaveFocus();
    await userEvent.keyboard("{ArrowDown}");
    expect(items[1]).toHaveFocus();
    await expectNoA11yViolations(container);
    await userEvent.keyboard("{Escape}");
    expect(btn).toHaveAttribute("aria-expanded", "false");
    expect(btn).toHaveFocus();
  });
});
