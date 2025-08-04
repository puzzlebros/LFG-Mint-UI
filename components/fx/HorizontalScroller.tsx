// components/HorizontalScroller.tsx
import React, { useEffect, useLayoutEffect, useState, useRef } from "react";
import { Box, Flex, Image, Text, TextProps } from "@chakra-ui/react";
import { keyframes } from "@emotion/react";

export type ScrollerItem = {
  iconSrc?: string;
  text: string;
  textStyle?: string;
  textProps?: Omit<TextProps, "children">;
};

export type HorizontalScrollerProps = {
  /** Items to scroll */
  items: ScrollerItem[];
  /** Seconds to scroll one full group */
  speed?: number;
  /** Bar height */
  height?: string;
  /** Background color */
  bgColor?: string;
  /** CSS z-index */
  zIndex?: number;
  /** fixed to viewport vs absolute within parent */
  fixed?: boolean;
  /** Align top or bottom of parent */
  align?: "top" | "bottom";
};

export default function HorizontalScroller({
  items,
  speed = 20,
  height = "50px",
  bgColor = "rgba(0,0,0,0.5)",
  zIndex = 10,
  fixed = false,
  align = "bottom",
}: HorizontalScrollerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);
  const [groupWidth, setGroupWidth] = useState(0);
  const [repeats, setRepeats] = useState(1);

  // Use layout effect on the client, fallback to effect on the server
  const useIsomorphicLayoutEffect =
    typeof window !== "undefined" ? useLayoutEffect : useEffect;

  useIsomorphicLayoutEffect(() => {
    const cw = containerRef.current?.clientWidth ?? 0;
    const gw = groupRef.current?.getBoundingClientRect().width ?? 0;
    if (cw > 0 && gw > 0) {
      setGroupWidth(gw);
      setRepeats(Math.ceil(cw / gw) + 1);
    }
  }, [items]);

  // Build the keyframes for scrolling
  const scroll = keyframes`
    0%   { transform: translateX(0); }
    100% { transform: translateX(-${groupWidth}px); }
  `;

  const animation = `${scroll} ${speed}s linear infinite`;

  // Render repeats of the item group
  const groups = Array.from({ length: repeats }).map((_, gi) => (
    <Flex
      key={gi}
      ref={gi === 0 ? groupRef : undefined}
      align="center"
      whiteSpace="nowrap"
      flexShrink={0}
    >
      {items.map((it, i) => (
        <Flex key={`${gi}-${i}`} align="center" flexShrink={0} mr="25px">
          {it.iconSrc && (
            <Image src={it.iconSrc} boxSize="24px" alt="" mr="4px" />
          )}
          <Text textStyle={it.textStyle} fontWeight="normal" {...it.textProps}>
            {it.text}
          </Text>
        </Flex>
      ))}
    </Flex>
  ));

  // Positioning styles (fixed or absolute)
  const posStyles = fixed
    ? ({ position: "fixed" as const, left: 0, [align]: 0 })
    : ({ position: "absolute" as const, left: 0, [align]: 0 });

  return (
    <Box
      ref={containerRef}
      {...posStyles}
      width="100%"
      height={height}
      bg={bgColor}
      overflow="hidden"
      zIndex={zIndex}
    >
      <Flex
        display="inline-flex"
        align="center"
        height="100%"
        width={`${groupWidth * repeats}px`}
        animation={animation}
      >
        {groups}
      </Flex>
    </Box>
  );
}
