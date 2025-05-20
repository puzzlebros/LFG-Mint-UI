// components/TraitDresser.tsx
import React, { useEffect, useRef, useState, WheelEvent } from 'react';
import { Box, Image } from '@chakra-ui/react';
import { v4 as uuid } from 'uuid';

interface TraitDresserProps {
  /** URL of the base skin image */
  skinSrc: string;
  /** Width and height of the skin & all overlays in px */
  skinSize?: number;
  /** Mapping of category → array of full-canvas PNG URLs */
  traitPaths: Record<string, string[]>;
}

interface Overlay {
  id: string;
  category: string;
  src: string;
  visible: boolean;
}

export default function TraitDresser({
  skinSrc,
  skinSize = 300,
  traitPaths,
}: TraitDresserProps) {
  const THRESHOLD = 50; // minimum accumulated scroll/swipe to trigger

  // Prepare one overlay slot per trait category
  const categories = Object.keys(traitPaths);
  const [overlays, setOverlays] = useState<Overlay[]>(
    () =>
      categories.map((cat) => ({
        id: uuid(),
        category: cat,
        src: '',
        visible: false,
      }))
  );

  // Keep refs for latest state
  const overlaysRef = useRef<Overlay[]>(overlays);
  useEffect(() => {
    overlaysRef.current = overlays;
  }, [overlays]);

  const animating = useRef(false);
  const queued = useRef(false);
  const inView = useRef(false);
  const wheelAccum = useRef(0);
  const touchStartY = useRef<number | null>(null);

  // IntersectionObserver to detect if component is in view
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        inView.current = entry.isIntersecting;
      },
      { threshold: 0.3 }
    );
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // Request a cycle: either start immediately or queue one
  function requestCycle() {
    if (animating.current) {
      queued.current = true;
    } else {
      cycleTrait();
    }
  }

  // Perform one fade-out → swap → fade-in
  function cycleTrait() {
    animating.current = true;
    queued.current = false;

    // Pick a random overlay slot and next image
    const current = overlaysRef.current;
    const idx = Math.floor(Math.random() * current.length);
    const { category, src: lastSrc } = current[idx];
    const variants = traitPaths[category];
    const choices = lastSrc ? variants.filter((u) => u !== lastSrc) : variants;
    const nextSrc =
      choices.length > 0
        ? choices[Math.floor(Math.random() * choices.length)]
        : variants[Math.floor(Math.random() * variants.length)];

    // 1) fade out
    setOverlays((prev) =>
      prev.map((o, i) => (i === idx ? { ...o, visible: false } : o))
    );

    // 2) swap & fade in after 300ms
    setTimeout(() => {
      setOverlays((prev) =>
        prev.map((o, i) =>
          i === idx
            ? { ...o, src: nextSrc, visible: true }
            : o
        )
      );
    }, 300);

    // 3) finish and handle queued
    setTimeout(() => {
      animating.current = false;
      if (queued.current) cycleTrait();
    }, 900);
  }

  // Wheel handler with accumulation
  useEffect(() => {
    function onWheel(e: WheelEvent) {
      if (!inView.current) return;
      if (e.deltaY <= 0) {
        wheelAccum.current = 0;
        return;
      }
      wheelAccum.current += e.deltaY;
      if (wheelAccum.current < THRESHOLD) return;

      wheelAccum.current = 0;
      e.preventDefault();
      requestCycle();
    }
    window.addEventListener('wheel', onWheel as any, { passive: false });
    return () => window.removeEventListener('wheel', onWheel as any);
  }, []);

  // Touch handlers for downward swipes
  useEffect(() => {
    function onTouchStart(e: globalThis.TouchEvent) {
      touchStartY.current = e.touches[0].clientY;
    }
    function onTouchMove(e: globalThis.TouchEvent) {
      const startY = touchStartY.current;
      if (startY === null || !inView.current) return;
      const currentY = e.touches[0].clientY;
      const deltaY = startY - currentY;
      if (deltaY > THRESHOLD) {
        e.preventDefault();
        touchStartY.current = currentY;
        requestCycle();
      }
    }
    window.addEventListener('touchstart', onTouchStart, { passive: false });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
    };
  }, []);

  return (
    <Box
      ref={containerRef}
      position="relative"
      w={`${skinSize}px`}
      h={`${skinSize}px`}
      mx="auto"
      mb={4}
    >
      {/* Base skin */}
      <Image
        src={skinSrc}
        boxSize={`${skinSize}px`}
        objectFit="cover"
        position="relative"
        zIndex={1}
      />

      {/* Overlays */}
      {overlays.map(({ id, src, visible }) => (
        <Image
          key={id}
          src={src}
          position="absolute"
          top="0"
          left="0"
          boxSize={`${skinSize}px`}
          objectFit="cover"
          zIndex={2}
          opacity={visible ? 1 : 0}
          transition="opacity 0.3s ease"
        />
      ))}
    </Box>
  );
}
