"use client";
import { useRef } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { PhoneFrame } from "./PhoneFrame";

/** Three real screens, drifting at different speeds as the page scrolls past. */
export function Gallery() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y1 = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : -60]);
  const y2 = useTransform(scrollYProgress, [0, 1], [40, reduce ? 40 : -100]);
  const y3 = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : -40]);
  return (
    <div ref={ref} className="grid gap-6 sm:grid-cols-3 sm:items-start">
      <motion.div style={{ y: y1 }} className="justify-self-center">
        <PhoneFrame shot="plan" alt="Plan screen for Day 1: a timeline of Fuglen Tokyo at 9:00, Meiji Jingu at 11:30, an open lunch slot at 13:00 with two saved places nearby, Shibuya Sky at 4:30 and Afuri Ramen at 7:30." />
      </motion.div>
      <motion.div style={{ y: y2 }} className="justify-self-center">
        <PhoneFrame shot="day" alt="Day route screen: hotel to four stops and back by transit, with total time, distance on foot and fares, and each stop's arrival time." />
      </motion.div>
      <motion.div style={{ y: y3 }} className="justify-self-center">
        <PhoneFrame shot="route" alt="Directions to Afuri Ramen Harajuku: transit, walk, drive and cycle compared, the steps, and the route drawn on the map." />
      </motion.div>
    </div>
  );
}
