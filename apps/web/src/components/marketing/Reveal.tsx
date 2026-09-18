"use client";
import { motion, useReducedMotion, type HTMLMotionProps } from "motion/react";

/**
 * Scroll reveal: a short rise into place, once, when a quarter of the block is in
 * view. Opacity is never touched, so the page reads (and passes contrast) at rest.
 * Off under reduced motion.
 */
export function Reveal({ delay = 0, ...rest }: HTMLMotionProps<"div"> & { delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { y: 26 }}
      whileInView={{ y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.55, ease: [0.2, 0.8, 0.2, 1], delay }}
      {...rest}
    />
  );
}
