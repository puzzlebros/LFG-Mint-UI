import React, { useEffect, useRef, useState, WheelEvent } from 'react';
import { Box, Image as ChakraImage } from '@chakra-ui/react';
import { v4 as uuid } from 'uuid';

interface TraitDresserProps {
  skinSrc: string;
  skinSize?: number;
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
  const THRESHOLD = 50;

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Static beak
  const beakSrc = traitPaths.beak[0];

  // Dynamic categories excluding beak
  const dynamicCats = Object.keys(traitPaths).filter((c) => c !== 'beak');
  const [overlays, setOverlays] = useState<Overlay[]>(() =>
    dynamicCats.map((cat) => ({
      id: uuid(),
      category: cat,
      src: '',
      visible: false,
    }))
  );
  const overlaysRef = useRef(overlays);
  useEffect(() => {
    overlaysRef.current = overlays;
  }, [overlays]);

  const animating = useRef(false);
  const queued = useRef(false);
  const inView = useRef(false);
  const wheelAccum = useRef(0);
  const touchStartY = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Intersection observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => (inView.current = entry.isIntersecting),
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Preload
  useEffect(() => {
    Object.values(traitPaths).flat().forEach((url) => {
      const img = new window.Image();
      img.src = url;
    });
  }, [traitPaths]);

  // Cycle logic
  function requestCycle() {
    if (animating.current) queued.current = true;
    else cycleTrait();
  }

  function cycleTrait() {
    animating.current = true;
    queued.current = false;

    const current = overlaysRef.current;
    const idx = Math.floor(Math.random() * current.length);
    const { category } = current[idx];
    const variants = traitPaths[category];
    const lastSrc = current[idx].src;
    const choices = lastSrc
      ? variants.filter((u) => u !== lastSrc)
      : variants;
    const nextSrc = choices.length
      ? choices[Math.floor(Math.random() * choices.length)]
      : variants[Math.floor(Math.random() * variants.length)];

    // fade out
    setOverlays((prev) =>
      prev.map((o, i) =>
        i === idx ? { ...o, visible: false } : o
      )
    );
    // swap & fade in
    setTimeout(() => {
      setOverlays((prev) =>
        prev.map((o, i) =>
          i === idx ? { ...o, src: nextSrc } : o
        )
      );
      setTimeout(() => {
        setOverlays((prev) =>
          prev.map((o, i) =>
            i === idx ? { ...o, visible: true } : o
          )
        );
      }, 50);
    }, 300);

    // finish
    setTimeout(() => {
      animating.current = false;
      if (queued.current) cycleTrait();
    }, 650);
  }

  // Wheel
  useEffect(() => {
    function onWheel(e: WheelEvent) {
      if (isMobile || !inView.current) return;
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
    window.addEventListener('wheel', onWheel as any, {
      passive: false,
    });
    return () =>
      window.removeEventListener('wheel', onWheel as any);
  }, [isMobile]);

  // Touch
  useEffect(() => {
    function onTouchStart(e: TouchEvent) {
      if (isMobile) return;
      touchStartY.current = e.touches[0].clientY;
    }
    function onTouchMove(e: TouchEvent) {
      if (
        isMobile ||
        touchStartY.current === null ||
        !inView.current
      )
        return;
      const currentY = e.touches[0].clientY;
      const deltaY = touchStartY.current - currentY;
      if (deltaY > THRESHOLD) {
        e.preventDefault();
        touchStartY.current = currentY;
        requestCycle();
      }
    }
    window.addEventListener('touchstart', onTouchStart, {
      passive: false,
    });
    window.addEventListener('touchmove', onTouchMove, {
      passive: false,
    });
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
    };
  }, [isMobile]);

  // Click (mobile)
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!isMobile || !inView.current) return;
      e.preventDefault();
      requestCycle();
    }
    const el = containerRef.current;
    if (el) {
      el.addEventListener('click', onClick);
      return () => el.removeEventListener('click', onClick);
    }
  }, [isMobile]);

  return (
    <Box
      ref={containerRef}
      position="relative"
      w={skinSize}
      h={skinSize}
      mx="auto"
      mb={4}
      cursor={isMobile ? 'pointer' : undefined}
    >
      {/* Base skin */}
      <ChakraImage
        src={skinSrc}
        boxSize={skinSize}
        objectFit="cover"
        position="relative"
        zIndex={1}
        alt="base skin"
      />

      {/* Clothes (behind beak) */}
      {overlays
        .filter((o) => o.category === 'clothes')
        .map(({ id, src, visible }) => (
          <ChakraImage
            key={id}
            src={src}
            alt="clothes trait"
            position="absolute"
            top={0}
            left={0}
            boxSize={skinSize}
            objectFit="cover"
            zIndex={2}
            opacity={visible ? 1 : 0}
            transition="opacity 0.3s ease"
            pointerEvents="none"
          />
        ))}

      {/* Beak (static mid-layer) */}
      <ChakraImage
        src={beakSrc}
        alt="beak trait"
        position="absolute"
        top={0}
        left={0}
        boxSize={skinSize}
        objectFit="cover"
        zIndex={3}
        pointerEvents="none"
      />

      {/* All other traits (above beak) */}
      {overlays
        .filter((o) => o.category !== 'clothes')
        .map(({ id, category, src, visible }) => (
          <ChakraImage
            key={id}
            src={src}
            alt={`${category} trait`}
            position="absolute"
            top={0}
            left={0}
            boxSize={skinSize}
            objectFit="cover"
            zIndex={4}
            opacity={visible ? 1 : 0}
            transition="opacity 0.3s ease"
            pointerEvents="none"
          />
        ))}
    </Box>
  );
}
