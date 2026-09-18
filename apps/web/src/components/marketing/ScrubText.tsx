"use client";
import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from "motion/react";

/** A paragraph whose words brighten one after another as it scrolls through the viewport. Plain text under reduced motion. */
export function ScrubText({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 85%", "end 45%"] });
  const words = text.split(" ");
  if (reduce) return <p ref={ref} className="text-[17px] leading-relaxed text-ink md:text-[19px]">{text}</p>;
  return (
    <p ref={ref} className="text-[17px] leading-relaxed text-ink md:text-[19px]">
      {words.map((w, i) => <Word key={i} word={w} progress={scrollYProgress} range={[i / words.length, (i + 1) / words.length]} />)}
    </p>
  );
}

function Word({ word, progress, range }: { word: string; progress: MotionValue<number>; range: [number, number] }) {
  const opacity = useTransform(progress, range, [0.72, 1]); // 0.72 keeps ink ≥ 4.5:1 on the canvas in both themes
  return <motion.span style={{ opacity }} className="inline-block">{word}&nbsp;</motion.span>;
}
