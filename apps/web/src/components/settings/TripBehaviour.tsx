"use client";
import { useState, useTransition } from "react";
import { SETTING_COPY, type TripBehaviour as Settings } from "@voya/core";
import { cx } from "@/lib/utils";

/** Trip behaviour toggles (Settings): real switches, saved on change, announced. */
export function TripBehaviour({ initial, action }: { initial: Settings; action: (input: unknown) => Promise<{ ok: true } | { error: string }> }) {
  const [value, setValue] = useState(initial);
  const [status, setStatus] = useState("");
  const [, start] = useTransition();
  const flip = (key: keyof Settings) => {
    const next = { ...value, [key]: !value[key] };
    setValue(next);
    start(async () => {
      const r = await action({ [key]: next[key] });
      setStatus("error" in r ? r.error : `${SETTING_COPY[key].title} ${next[key] ? "on" : "off"}.`);
      if ("error" in r) setValue(value);
    });
  };
  return (
    <>
      {(Object.keys(SETTING_COPY) as (keyof Settings)[]).map((key) => (
        <div key={key} className="flex items-center gap-3 px-3.5 py-3">
          <span className="min-w-0 flex-1"><span id={`set-${key}`} className="block text-[15px] font-semibold">{SETTING_COPY[key].title}</span><span className="block text-[12px] text-muted">{SETTING_COPY[key].detail}</span></span>
          <button type="button" role="switch" aria-checked={value[key]} aria-labelledby={`set-${key}`} onClick={() => flip(key)} className={cx("relative h-7 w-12 shrink-0 rounded-full transition-colors duration-(--dur-fast)", value[key] ? "bg-primary" : "bg-line-strong")}>
            <span aria-hidden="true" className={cx("absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-card transition-[left] duration-(--dur-fast)", value[key] ? "left-[22px]" : "left-0.5")} />
          </button>
        </div>
      ))}
      <p role="status" className={status ? "px-3.5 py-2 text-[12px] font-semibold text-primary" : "sr-only"}>{status}</p>
    </>
  );
}
