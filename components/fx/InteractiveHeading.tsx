import { Heading, HeadingProps, useBreakpointValue } from "@chakra-ui/react";
import { useRef, useEffect, useState } from "react";

/** clamp a number to [min,max] */
function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export interface InteractiveHeadingProps
  extends Omit<HeadingProps, "children" | "transition" | "transitionDuration"> {
  children: React.ReactNode;
  minWidth?: number;
  maxWidth?: number;
  minSlant?: number;
  maxSlant?: number;
  /** mobile-specific overrides */
  minWidthMobile?: number;
  maxWidthMobile?: number;
  minSlantMobile?: number;
  maxSlantMobile?: number;
  previewWidth?: number;
  previewSlant?: number;
  transitionDuration?: number;
  enableTilt?: boolean;
  /** how long to wait for a tilt-permission response (ms) */
  permissionTimeout?: number;
}

export default function InteractiveHeading({
  children,
  minWidth           = 26,
  maxWidth           = 146,
  minSlant           = -15,
  maxSlant           = 15,
  minWidthMobile    = minWidth,
  maxWidthMobile    = maxWidth,
  minSlantMobile    = minSlant,
  maxSlantMobile    = maxSlant,
  previewWidth       = (26 + 146) / 2,
  previewSlant       = 0,
  transitionDuration = 0.3,
  enableTilt         = true,
  permissionTimeout  = 5000,

  fontSize      = "6xl",
  letterSpacing = "0.2em",
  lineHeight    = "1.1",
  ...rest
}: InteractiveHeadingProps) {
  const ref = useRef<HTMLHeadingElement>(null);
  const [tiltAllowed, setTiltAllowed]           = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  // determine responsive axis limits
  const effectiveMinWidth = useBreakpointValue({ base: minWidthMobile, md: minWidth })!;
  const effectiveMaxWidth = useBreakpointValue({ base: maxWidthMobile, md: maxWidth })!;
  const effectiveMinSlant = useBreakpointValue({ base: minSlantMobile, md: minSlant })!;
  const effectiveMaxSlant = useBreakpointValue({ base: maxSlantMobile, md: maxSlant })!;

  // Utility to check if current device is mobile
  function isMobile() {
    if (typeof window === "undefined") return false;
    return window.innerWidth < 768;
  }

  // 1) Core: pointer + deviceorientation (if allowed), with mobile throttling
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let pointerFrameId: number | null = null;
    let orientationFrameId: number | null = null;

    // Always re-use this logic for both pointer and tilt
    const updateAxes = (xNorm: number, yNorm: number) => {
      const wd = effectiveMinWidth + xNorm * (effectiveMaxWidth - effectiveMinWidth);
      const sl = effectiveMinSlant + yNorm * (effectiveMaxSlant - effectiveMinSlant);
      el.style.fontVariationSettings =
        `"wdth" ${wd.toFixed(1)}, "slnt" ${sl.toFixed(1)}`;
    };

    // Pointer move handler
    const onPointerMove = (e: PointerEvent) => {
      if (isMobile()) {
        if (pointerFrameId) cancelAnimationFrame(pointerFrameId);
        pointerFrameId = requestAnimationFrame(() => {
          updateAxes(
            clamp(e.clientX / window.innerWidth, 0, 1),
            clamp(e.clientY / window.innerHeight, 0, 1)
          );
        });
      } else {
        updateAxes(
          clamp(e.clientX / window.innerWidth, 0, 1),
          clamp(e.clientY / window.innerHeight, 0, 1)
        );
      }
    };
    window.addEventListener("pointermove", onPointerMove);

    // Device orientation handler
    let onDeviceOrientation: ((e: DeviceOrientationEvent) => void) | null = null;
    if (enableTilt && tiltAllowed) {
      onDeviceOrientation = (e: DeviceOrientationEvent) => {
        const gamma = e.gamma ?? 0;
        const beta  = e.beta  ?? 0;
        if (isMobile()) {
          if (orientationFrameId) cancelAnimationFrame(orientationFrameId);
          orientationFrameId = requestAnimationFrame(() => {
            updateAxes(
              clamp((gamma + 45) / 90, 0, 1),
              clamp((beta  + 45) / 90, 0, 1)
            );
          });
        } else {
          updateAxes(
            clamp((gamma + 45) / 90, 0, 1),
            clamp((beta  + 45) / 90, 0, 1)
          );
        }
      };
      window.addEventListener("deviceorientation", onDeviceOrientation);
    }

    return () => {
      if (pointerFrameId) cancelAnimationFrame(pointerFrameId);
      window.removeEventListener("pointermove", onPointerMove);
      if (onDeviceOrientation) {
        if (orientationFrameId) cancelAnimationFrame(orientationFrameId);
        window.removeEventListener("deviceorientation", onDeviceOrientation);
      }
    };
  }, [
    effectiveMinWidth,
    effectiveMaxWidth,
    effectiveMinSlant,
    effectiveMaxSlant,
    enableTilt,
    tiltAllowed,
  ]);

  // 2) Prompt for permission on first tap (iOS)
  useEffect(() => {
    const devOrient = (DeviceOrientationEvent as any);
    if (enableTilt && typeof devOrient?.requestPermission === "function") {
      const el = ref.current;
      const handleTap = async () => {
        try {
          const perm: string = await devOrient.requestPermission();
          if (perm === "granted") {
            setTiltAllowed(true);
          } else {
            setPermissionDenied(true);
          }
        } catch {
          setPermissionDenied(true);
        }
        if (el) el.removeEventListener("pointerdown", handleTap as EventListener);
      };
      el?.addEventListener("pointerdown", handleTap as EventListener);
    } else {
      setTiltAllowed(true);
    }
  }, [enableTilt]);

  // 3) Fallback on denial or timeout
  useEffect(() => {
    if (!enableTilt) return;
    let timer: NodeJS.Timeout;
    if (!tiltAllowed && !permissionDenied) {
      timer = setTimeout(() => setPermissionDenied(true), permissionTimeout);
    }
    return () => clearTimeout(timer as any);
  }, [enableTilt, tiltAllowed, permissionDenied, permissionTimeout]);

  // 4) Auto-animate on deny
  useEffect(() => {
    if (!(enableTilt && permissionDenied)) return;
    let rafId: number;
    let startTs = 0;
    const animate = (ts: number) => {
      if (!startTs) startTs = ts;
      const t = (ts - startTs) / 1000;
      const xNorm = (Math.sin(t) + 1) / 2;
      const yNorm = (Math.cos(t) + 1) / 2;
      if (ref.current) {
        const wd = effectiveMinWidth + xNorm * (effectiveMaxWidth - effectiveMinWidth);
        const sl = effectiveMinSlant + yNorm * (effectiveMaxSlant - effectiveMinSlant);
        ref.current.style.fontVariationSettings =
          `"wdth" ${wd.toFixed(1)}, "slnt" ${sl.toFixed(1)}`;
      }
      rafId = requestAnimationFrame(animate);
    };
    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [
    enableTilt,
    permissionDenied,
    effectiveMinWidth,
    effectiveMaxWidth,
    effectiveMinSlant,
    effectiveMaxSlant,
  ]);

  // initial preview
  const initial = `"wdth" ${previewWidth}, "slnt" ${previewSlant}`;

  return (
    <Heading
      ref={ref}
      as="h1"
      fontFamily={`"nickel-gothic-variable", sans-serif`}
      fontSize={fontSize}
      letterSpacing={letterSpacing}
      lineHeight={lineHeight}
      sx={{
        fontVariationSettings: initial,
        transition: `font-variation-settings ${transitionDuration}s ease`,
      }}
      {...rest}
    >
      {children}
    </Heading>
  );
}
