import axe from "axe-core";
import { expect } from "vitest";

/** Runs axe on a rendered container and fails with a readable list of violations. */
export async function expectNoA11yViolations(container: Element) {
  const results = await axe.run(container, {
    rules: { region: { enabled: false } }, // component tests render fragments, not full pages
  });
  const summary = results.violations.map((v) => `${v.id}: ${v.help}\n  ${v.nodes.map((n) => n.target.join(" ")).join("\n  ")}`).join("\n");
  expect(summary, summary).toBe("");
}
