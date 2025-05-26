import React, { useEffect, useRef, useState, WheelEvent } from 'react';
import { Box, Image as ChakraImage } from '@chakra-ui/react';
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

export default function TraitDresser({ skinSrc, skinSize = 300, traitPaths }: TraitDresserProps) {
  const THRESHOLD = 50;

  // Track mobile/desktop breakpoint on client
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    function check() {
      setIsMobile(typeof window !== 'undefined' && window.innerWidth < 768);
    }
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Prepare overlays
  const categories = Object.keys(traitPaths);
  const [overlays, setOverlays] = useState<Overlay[]>(() =>
    categories.map((cat) => ({ id: uuid(), category: cat, src: '', visible: false }))
  );
  const overlaysRef = useRef<Overlay[]>(overlays);
  useEffect(() => { overlaysRef.current = overlays; }, [overlays]);

  // Animation state
  const animating = useRef(false);
  const queued = useRef(false);
  const inView = useRef(false);
  const wheelAccum = useRef(0);
  const touchStartY = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Visibility observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { inView.current = entry.isIntersecting; },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Preload DOM images
  useEffect(() => {
    Object.values(traitPaths).flat().forEach((url) => {
      // use DOM Image, not ChakraImage
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
    const choices = lastSrc ? variants.filter((u) => u !== lastSrc) : variants;
    const nextSrc = choices.length
      ? choices[Math.floor(Math.random() * choices.length)]
      : variants[Math.floor(Math.random() * variants.length)];

    // fade out
    setOverlays((prev) => prev.map((o, i) => (i === idx ? { ...o, visible: false } : o)));
    // swap while hidden
    setTimeout(() => {
      setOverlays((prev) => prev.map((o, i) => (i === idx ? { ...o, src: nextSrc } : o)));
      // fade in
      setTimeout(() => {
        setOverlays((prev) => prev.map((o, i) => (i === idx ? { ...o, visible: true } : o)));
      }, 50);
    }, 300);
    // complete
    setTimeout(() => {
      animating.current = false;
      if (queued.current) cycleTrait();
    }, 650);
  }

  // Handlers
  useEffect(() => {
    function onWheel(e: WheelEvent) {
      if (isMobile || !inView.current) return;
      if (e.deltaY <= 0) { wheelAccum.current = 0; return; }
      wheelAccum.current += e.deltaY;
      if (wheelAccum.current < THRESHOLD) return;
      wheelAccum.current = 0;
      e.preventDefault();
      requestCycle();
    }
    window.addEventListener('wheel', onWheel as any, { passive: false });
    return () => window.removeEventListener('wheel', onWheel as any);
  }, [isMobile]);

  useEffect(() => {
    function onTouchStart(e: TouchEvent) {
      if (isMobile) return;
      touchStartY.current = e.touches[0].clientY;
    }
    function onTouchMove(e: TouchEvent) {
      if (isMobile || touchStartY.current === null || !inView.current) return;
      const currentY = e.touches[0].clientY;
      const deltaY = touchStartY.current - currentY;
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
  }, [isMobile]);

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
      <ChakraImage
        src={skinSrc}
        boxSize={skinSize}
        objectFit="cover"
        position="relative"
        zIndex={1}
      />
      {overlays.map(({ id, src, visible }) => (
        <ChakraImage
          key={id}
          src={src}
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
    </Box>
  );
}
