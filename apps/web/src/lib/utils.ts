/** Tiny className joiner — avoids a dependency for the common case. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
