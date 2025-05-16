// components/InteractiveHeading.tsx
import { Heading, HeadingProps } from "@chakra-ui/react";
import { useRef, useEffect } from "react";

export interface InteractiveHeadingProps
  extends Omit<HeadingProps, "children" | "transitionDuration"> {
  children: React.ReactNode;

  /** wdth axis caps: [minWidth .. maxWidth] */
  minWidth?: number;
  maxWidth?: number;

  /** slnt axis caps: [minSlant .. maxSlant] */
  minSlant?: number;
  maxSlant?: number;

  /** preview values before pointer input */
  previewWdth?: number;
  previewSlnt?: number;

  /** VF transition duration (seconds) */
  transitionDuration?: number;
}

export default function InteractiveHeading({
  children,
  minWidth          = 26,
  maxWidth          = 146,
  minSlant         = -15,
  maxSlant          = 15,
  transitionDuration = 0.3,
  fontSize       = "6xl",
  letterSpacing  = "0.2em",
  lineHeight    = "1.1",
  previewSlnt   = 0,
  previewWdth   = 500,
  ...rest
}: InteractiveHeadingProps) {
  const ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!ref.current) return;

      // normalize to [0..1]
      const x = e.clientX / window.innerWidth;
      const y = e.clientY / window.innerHeight;

      // map into your caps
      const wd = minWidth + x * (maxWidth - minWidth);
      const sl = minSlant + y * (maxSlant - minSlant);

      // only this one node ever sees these writes
      ref.current.style.fontVariationSettings = `"wdth" ${wd}, "slnt" ${sl}`;
    };

    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [minWidth, maxWidth, minSlant, maxSlant]);

  return (
    <Heading
      ref={ref}
      {...rest}      // <-- this is the KEY
      as="h1"
      fontSize={fontSize}
      letterSpacing={letterSpacing}
      lineHeight={lineHeight}
      fontFamily={`"nickel-gothic-variable", sans-serif`}
      style={{
        fontVariationSettings: 
          `"wdth" ${previewWdth}, "slnt" ${previewSlnt}`,
        transition: `font-variation-settings ${transitionDuration}s ease`,
      }}
    >
      {children}
    </Heading>
  );
}
