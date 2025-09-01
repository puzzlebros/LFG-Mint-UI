// components/Cloud.tsx
import React, {
  useState,
  useEffect,
  useCallback,
} from "react";
import { Image } from "@chakra-ui/react";
import { keyframes } from "@emotion/react";

// same drift keyframes, including scale()
const drift = keyframes`
  0%   { transform: translateX(var(--startX)) translateY(var(--top)) scale(var(--scale)); opacity: 0; }
  10%  { opacity: 1; }
  90%  { opacity: 1; }
  100% { transform: translateX(var(--endX))   translateY(var(--top)) scale(var(--scale)); opacity: 0; }
`;

interface CloudProps {
  src: string;
  containerWidth: number;
  containerHeight: number;

  /** Scale range (default: 0.8→1.2) */
  minScale?: number;
  maxScale?: number;

  /** Duration range in seconds (default: 20→40) */
  minDuration?: number;
  maxDuration?: number;

  /** If a cloud’s scale is above this (default midpoint), it will float above the heading */
  highScaleThreshold?: number;
  /** z-index to use for “big” clouds (default: 2, above the heading’s zIndex=1) */
  highScaleZIndex?: number;
}

export default function Cloud({
  src,
  containerWidth,
  containerHeight,
  minScale = 0.5,
  maxScale = 3,
  minDuration = 20,
  maxDuration = 40,
  highScaleThreshold = 2.5,
  highScaleZIndex = 2,
}: CloudProps) {
  // Roll all CSS vars
  const getConfig = useCallback(
    (initial: boolean) => {
      const fromLeft = Math.random() < 0.5;
      const offsetX  = 250;
      const startX   = fromLeft ? -offsetX : containerWidth + offsetX;
      const endX     = fromLeft ? containerWidth + offsetX : -offsetX;
      const top      = Math.random() * 0.8 * containerHeight;

      // speed & size
      const duration = minDuration + Math.random() * (maxDuration - minDuration);
      const scale    = minScale    + Math.random() * (maxScale    - minScale);

      // only for first mount, jump mid-animation
      const delay = initial ? -Math.random() * duration : 0;

      return {
        startX:   `${startX}px`,
        endX:     `${endX}px`,
        top:      `${top}px`,
        duration:`${duration}s`,
        scale,
        delay:    `${delay}s`,
      };
    },
    [containerWidth, containerHeight, minDuration, maxDuration, minScale, maxScale]
  );

  // iteration key to remount on each loop
  const [iter, setIter] = useState(0);
  const [cfg, setCfg] = useState(() => getConfig(true));

  // whenever iter changes, re-roll
  useEffect(() => {
    setCfg(getConfig(iter === 0));
  }, [iter, getConfig]);

  // schedule the next “respawn” exactly after duration seconds
  useEffect(() => {
    const seconds = parseFloat(cfg.duration);
    const id = window.setTimeout(() => setIter(i => i + 1), seconds * 1000);
    return () => window.clearTimeout(id);
  }, [cfg]);

  // choose z-index based on scale
  const zIndex = cfg.scale > highScaleThreshold ? highScaleZIndex : 0;

  return (
    <Image
      key={iter}
      src={src}
      position="absolute"
      top={0}
      left={0}
      boxSize="100px"
      objectFit="contain"
      pointerEvents="none"
      sx={{
        "--startX":  cfg.startX,
        "--endX":    cfg.endX,
        "--top":     cfg.top,
        "--scale":   cfg.scale,
        "--delay":   cfg.delay,

        transform:      "translateX(var(--startX)) translateY(var(--top)) scale(var(--scale))",
        opacity:        0,
        animation:      `${drift} ${cfg.duration} linear var(--delay)`,
        animationFillMode: "forwards",
        willChange:     "transform, opacity",

        zIndex,  // bigger clouds will float above the heading (zIndex > 1)
      } as any}
    />
  );
}
