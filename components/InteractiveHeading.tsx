// components/InteractiveHeading.tsx
import { Heading, HeadingProps } from "@chakra-ui/react";
import { useRef, useEffect } from "react";

/** clamp a number to [min,max] */
function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export interface InteractiveHeadingProps
  extends Omit<HeadingProps, "children" | "transition" | "transitionDuration"> {
  children: React.ReactNode;

  /** width axis caps (e.g. 26→146) */
  minWidth?: number;
  maxWidth?: number;

  /** slant axis caps in font units (e.g. −15→+15) */
  minSlant?: number;
  maxSlant?: number;

  /** initial “preview” before any input */
  previewWidth?: number;
  previewSlant?: number;

  /** how quickly the fontVariationSettings transition (seconds) */
  transitionDuration?: number;

  /** enable/disable tilt (defaults to true) */
  enableTilt?: boolean;
}

export default function InteractiveHeading({
  children,
  minWidth          = 26,
  maxWidth          = 146,
  minSlant         = -15,
  maxSlant          = 15,
  previewWidth      = (26 + 146) / 2,
  previewSlant      = 0,
  transitionDuration = 0.3,
  enableTilt         = true,

  fontSize       = "6xl",
  letterSpacing  = "0.2em",
  lineHeight     = "1.1",
  ...rest
}: InteractiveHeadingProps) {
  const ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // helper: compute and apply axes
    const updateAxes = (xNorm: number, yNorm: number) => {
      const wd = minWidth + xNorm * (maxWidth - minWidth);
      const sl = minSlant + yNorm * (maxSlant - minSlant);
      el.style.fontVariationSettings = `"wdth" ${wd.toFixed(1)}, "slnt" ${sl.toFixed(1)}`;
    };

    // 1) pointermove handler
    const onPointerMove = (e: PointerEvent) => {
      const xNorm = clamp(e.clientX / window.innerWidth, 0, 1);
      const yNorm = clamp(e.clientY / window.innerHeight, 0, 1);
      updateAxes(xNorm, yNorm);
    };
    window.addEventListener("pointermove", onPointerMove);

    // 2) deviceorientation handler
    let onDeviceOrientation: ((e: DeviceOrientationEvent) => void) | null = null;
    if (enableTilt && typeof DeviceOrientationEvent !== "undefined") {
      onDeviceOrientation = (e) => {
        // gamma: left/right tilt [-90…90], beta: front/back tilt [-180…180]
        const gamma = e.gamma ?? 0;
        const beta  = e.beta  ?? 0;
        // assume comfortable tilt range ±45°, map to [0..1]
        const xNorm = clamp((gamma + 45) / 90, 0, 1);
        const yNorm = clamp((beta  + 45) / 90, 0, 1);
        updateAxes(xNorm, yNorm);
      };

      // iOS 13+ requires user permission
      const devOrient = DeviceOrientationEvent as any;
      if (typeof devOrient.requestPermission === "function") {
        devOrient
          .requestPermission()
          .then((perm: string) => {
            if (perm === "granted") {
              window.addEventListener("deviceorientation", onDeviceOrientation!);
            }
          })
          .catch(console.error);
      } else {
        window.addEventListener("deviceorientation", onDeviceOrientation);
      }
    }

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      if (onDeviceOrientation) {
        window.removeEventListener("deviceorientation", onDeviceOrientation);
      }
    };
  }, [
    minWidth,
    maxWidth,
    minSlant,
    maxSlant,
    enableTilt,
  ]);

  // initial preview style
  const initialSettings = `"wdth" ${previewWidth}, "slnt" ${previewSlant}`;

  return (
    <Heading
      ref={ref}
      as="h1"
      fontFamily={`"nickel-gothic-variable", sans-serif`}
      fontSize={fontSize}
      letterSpacing={letterSpacing}
      lineHeight={lineHeight}
      sx={{
        fontVariationSettings: initialSettings,
        transition:            `font-variation-settings ${transitionDuration}s ease`,
      }}
      {...rest}
    >
      {children}
    </Heading>
  );
}
