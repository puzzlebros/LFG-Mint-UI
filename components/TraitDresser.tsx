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
  // flatten categories
  const categories = Object.keys(traitPaths);
  // overlays state: one slot per category
  const [overlays, setOverlays] = useState<Overlay[]>(() =>
    categories.map(cat => ({
      id:       uuid(),
      category: cat,
      src:      '',       // start empty
      visible:  false,
    }))
  );

  // Keep a ref in sync so cycleTrait sees the latest state
  const overlaysRef = useRef<Overlay[]>(overlays)
  useEffect(() => {
    overlaysRef.current = overlays
  }, [overlays])

  const containerRef = useRef<HTMLDivElement>(null);
  const animating   = useRef(false);
  const queued      = useRef(false);
  const inView      = useRef(false);
  const THRESHOLD   = 15;

  // IntersectionObserver to set inView
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => (inView.current = e.isIntersecting),
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // listen for downward scroll
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      if (!inView.current || e.deltaY <= 0 || Math.abs(e.deltaY) < THRESHOLD) {
        return;
      }
      e.preventDefault();
      if (animating.current) {
        queued.current = true;
      } else {
        cycleTrait();
      }
    };
    window.addEventListener('wheel', onWheel as any, { passive: false });
    return () => window.removeEventListener('wheel', onWheel as any);
  }, []);

  function cycleTrait() {
    animating.current = true
    queued.current = false

    // read the *up-to-date* overlays
    const current = overlaysRef.current
    const chosenIndex = Math.floor(Math.random() * current.length)
    const { category, src: lastSrc } = current[chosenIndex]
    const variants = traitPaths[category]

    // filter out the *current* src so you never repeat it
    const choices = lastSrc ? variants.filter((u) => u !== lastSrc) : variants
    const nextSrc =
      choices.length > 0
        ? choices[Math.floor(Math.random() * choices.length)]
        : variants[Math.floor(Math.random() * variants.length)]

    // 1) fade out
    setOverlays((prev) =>
      prev.map((o, i) =>
        i === chosenIndex ? { ...o, visible: false } : o
      )
    )

    // 2) swap & fade in
    setTimeout(() => {
      setOverlays((prev) =>
        prev.map((o, i) =>
          i === chosenIndex
            ? { ...o, src: nextSrc, visible: true }
            : o
        )
      )
    }, 600)

    // 3) end cycle (and drain queue)
    setTimeout(() => {
      animating.current = false
      if (queued.current) cycleTrait()
    }, 1200)
  }

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

      {/* Full-canvas overlays */}
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
          transition="opacity 0.6s ease"
        />
      ))}
    </Box>
  );
}
