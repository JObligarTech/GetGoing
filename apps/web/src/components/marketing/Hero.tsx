"use client";
import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { Map } from "@/components/map/Map";
import { Button } from "@/components/ui/Button";
import { PhoneFrame } from "./PhoneFrame";

const WORDS = ["Your", "whole", "trip.", "One", "place."];

/**
 * The welcome screen's dark world map, opened up: the headline rises in word by word,
 * the Tokyo pin breathes, and the phone (a real Home screenshot) floats and tilts
 * away as you scroll. All of it settles instantly under reduced motion.
 */
export function Hero() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const phoneY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 120]);
  const phoneRotate = useTransform(scrollYProgress, [0, 1], [-6, reduce ? -6 : 4]);
  const textY = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 60]);

  return (
    <section ref={ref} aria-labelledby="hero-title" className="relative overflow-hidden bg-[#121614] text-[#F1F3EF]">
      <div className="absolute inset-0" aria-hidden="true">
        <Map center={{ lat: 28, lng: 100 }} zoom={1.7} dark static label="" pins={[{ id: "tokyo", lat: 35.68, lng: 139.7, color: "#7DBA8E" }]} />
      </div>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_40%,rgba(18,22,20,.35),rgba(18,22,20,.92)_70%)]" aria-hidden="true" />
      <div className="relative mx-auto grid max-w-6xl gap-10 px-4 pt-28 pb-16 md:px-7 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:pt-36 lg:pb-24">
        <motion.div style={{ y: textY }} className="flex flex-col gap-6">
          <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#98A39C]">Travel companion · iPhone, Android and web</p>
          <h1 id="hero-title" className="text-[44px] leading-[1.02] font-extrabold tracking-[-0.03em] text-balance md:text-[64px] lg:text-[72px]">
            {WORDS.map((w, i) => (
              <motion.span key={w} className="inline-block" initial={reduce ? false : { opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1], delay: 0.1 + i * 0.07 }}>
                {w}{i < WORDS.length - 1 ? " " : ""}
              </motion.span>
            ))}
          </h1>
          <p className="font-serif text-[22px] italic leading-snug text-[#C9D3CC] md:text-[26px]">Because the trip is the context for everything.</p>
          <p className="max-w-[52ch] text-[16px] leading-relaxed text-[#C9D3CC] md:text-[17px]">
            Save the hotel once. Voya carries it into directions, group routes, money and the day&apos;s plan, so you stop typing the same things on the far side of the world.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button href="/signup" variant="light" size="cta">Create account</Button>
            <Button href="/login" variant="translucent" size="cta">Log in</Button>
          </div>
          <p className="text-[12.5px] text-[#98A39C]">Free while we build. No card, no tracking, OpenStreetMap under the hood.</p>
        </motion.div>

        <motion.div style={{ y: phoneY, rotate: phoneRotate }} className="mx-auto w-full max-w-[300px] lg:mx-0 lg:justify-self-end">
          <motion.div animate={reduce ? undefined : { y: [0, -10, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}>
            <PhoneFrame priority shot="home" alt="Voya Home screen for a trip called Japan 2027: a live map of Tokyo, 12 days away, local and home clocks, the stay at Hotel Gracery Shinjuku, and the places saved for March 15." />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
