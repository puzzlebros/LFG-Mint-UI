import React, { useMemo } from "react";
import { Image, ImageProps, keyframes } from "@chakra-ui/react";

const drift = keyframes`
  0%   { transform: translateX(var(--startX)) translateY(var(--top)); opacity: 0; }
  10%  { opacity: 1; }
  90%  { opacity: 1; }
  100% { transform: translateX(var(--endX))   translateY(var(--top)); opacity: 0; }
`;

interface CloudProps {
  src: string;
  containerWidth: number;
  containerHeight: number;
}

export default function Cloud({
  src,
  containerWidth,
  containerHeight,
}: CloudProps) {
  const { startX, endX, top, duration } = useMemo(() => {
    const fromLeft   = Math.random() < 0.5;
    const startXVal  = fromLeft ? -250 : containerWidth + 250;
    const endXVal    = fromLeft ? containerWidth + 250 : -250;
    const topVal     = Math.random() * 0.8 * containerHeight;
    const durSeconds = 20 + Math.random() * 20;

    return {
      startX:   `${startXVal}px`,
      endX:     `${endXVal}px`,
      top:      `${topVal}px`,
      duration: `${durSeconds}s`,
    };
  }, [containerWidth, containerHeight]);

  return (
    <Image
      src={src}
      position="absolute"
      top={0}
      left={0}
      boxSize="100px"
      objectFit="contain"
      pointerEvents="none"
      zIndex={0}  /* explicitly under everything */
      sx={{
        "--startX":     startX,
        "--endX":       endX,
        "--top":        top,
        transform:      "translateX(var(--startX)) translateY(var(--top))",
        opacity:        0,
        animation:      `${drift} ${duration} linear infinite`,
        willChange:     "transform, opacity",
      } as any}
    />
  );
}
