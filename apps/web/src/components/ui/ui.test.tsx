import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button";
import { Checkbox, Field } from "./Form";
import { SegmentedControl } from "./SegmentedControl";
import { Chip, IconButton, ListRow, Tile } from "./primitives";
import { expectNoA11yViolations } from "@/test/a11y";

describe("Button", () => {
  it("renders as a button by default and as a link with href", async () => {
    const onClick = vi.fn();
    const { container, rerender } = render(<Button onClick={onClick}>Save</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onClick).toHaveBeenCalledOnce();
    rerender(<Button href="/home">Home</Button>);
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/home");
    await expectNoA11yViolations(container);
  });
  it("announces loading and blocks clicks", async () => {
    const onClick = vi.fn();
    render(<Button loading onClick={onClick}>Save</Button>);
    const btn = screen.getByRole("button", { name: /save/i });
    expect(btn).toHaveAttribute("aria-busy", "true");
    expect(btn).toBeDisabled();
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });
});

describe("Field / Checkbox", () => {
  it("wires label, hint and error to the input", async () => {
    const { container } = render(<Field label="Email" name="email" hint="We never share it" error="Enter a valid email" />);
    const input = screen.getByRole("textbox", { name: "Email" });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("We never share it Enter a valid email");
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid email");
    await expectNoA11yViolations(container);
  });
  it("checkbox is unchecked by default (no pre-ticked consent)", () => {
    render(<Checkbox name="marketingOptIn" label="Send me tips" />);
    expect(screen.getByRole("checkbox", { name: /send me tips/i })).not.toBeChecked();
  });
});

describe("SegmentedControl", () => {
  it("is a radiogroup with roving focus and arrow-key movement", async () => {
    const onChange = vi.fn();
    const { container } = render(<SegmentedControl label="Trip day" value="a" onChange={onChange} options={[{ value: "a", label: "1" }, { value: "b", label: "2" }, { value: "c", label: "3" }]} />);
    const group = screen.getByRole("radiogroup", { name: "Trip day" });
    const radios = screen.getAllByRole("radio");
    expect(radios[0]).toHaveAttribute("aria-checked", "true");
    expect(radios[0]).toHaveAttribute("tabindex", "0");
    expect(radios[1]).toHaveAttribute("tabindex", "-1");
    radios[0]!.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenCalledWith("b");
    expect(group).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });
});

describe("ListRow / Tile / Chip / IconButton", () => {
  it("row as link exposes an accessible name and current state", async () => {
    const { container } = render(
      <div>
        <ListRow href="/trips/1" title="Japan 2027" subtitle="Mar 15–29" active leading={<Tile name="Japan 2027" />} trailing={<Chip>12 days away</Chip>} chevron />
        <IconButton label="Notifications">🔔</IconButton>
      </div>,
    );
    const link = screen.getByRole("link", { name: /Japan 2027/ });
    expect(link).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: "Notifications" })).toBeInTheDocument();
    // The tile letter is decorative: not exposed as text to AT.
    expect(screen.queryByText("J", { selector: "[aria-hidden=false]" })).toBeNull();
    await expectNoA11yViolations(container);
  });
  it("tile uses the first letter, even with symbols", () => {
    const { container } = render(<Tile name="· Bali" />);
    expect(container.textContent).toBe("B");
  });
});
