"use client";
import { useState } from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

/** Web Share API where available (phones), otherwise copies the text and confirms via a live region. */
export function ShareEta({ text }: { text: string }) {
  const [done, setDone] = useState<string | null>(null);
  const share = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ text });
        setDone("Shared");
      } else {
        await navigator.clipboard.writeText(text);
        setDone("Copied to clipboard");
      }
    } catch {
      setDone(null);
    }
  };
  return (
    <>
      <Button variant="ink" full icon={<Share2 size={18} />} onClick={share}>Share ETA</Button>
      <span role="status" className="sr-only">{done ?? ""}</span>
    </>
  );
}
