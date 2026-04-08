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

  /** kept for compatibility, now effectively unused */
  enableMobileAutoAnimate?: boolean;

  /** when this changes, on mobile we randomize once */
  randomizeOnMobileKey?: number | string;
}

export default function InteractiveHeading({
  children,
  minWidth = 26,
  maxWidth = 146,
  minSlant = -15,
  maxSlant = 15,
  minWidthMobile = minWidth,
  maxWidthMobile = maxWidth,
  minSlantMobile = minSlant,
  maxSlantMobile = maxSlant,
  previewWidth = (26 + 146) / 2,
  previewSlant = 0,
  transitionDuration = 0.3,
  enableTilt = true,
  permissionTimeout = 5000,
  enableMobileAutoAnimate = true, // no-op now
  randomizeOnMobileKey,

  fontSize = "6xl",
  letterSpacing = "0.2em",
  lineHeight = "1.1",
  ...rest
}: InteractiveHeadingProps) {
  const ref = useRef<HTMLHeadingElement>(null);
  const rafId = useRef<number | null>(null);
  const [tiltAllowed, setTiltAllowed] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);

  useEffect(() => {
    setIsMobileDevice(isMobile());
  }, []);

  // determine responsive axis limits
  const effectiveMinWidth = useBreakpointValue({
    base: minWidthMobile,
    md: minWidth,
  })!;
  const effectiveMaxWidth = useBreakpointValue({
    base: maxWidthMobile,
    md: maxWidth,
  })!;
  const effectiveMinSlant = useBreakpointValue({
    base: minSlantMobile,
    md: minSlant,
  })!;
  const effectiveMaxSlant = useBreakpointValue({
    base: maxSlantMobile,
    md: maxSlant,
  })!;

  // Utility to check if current device is mobile
  function isMobile() {
    if (typeof window === "undefined") return false;
    return window.innerWidth < 768;
  }

  // Helper to apply wdth/slnt given normalized [0,1] coords
  function applyAxesFromNorm(xNorm: number, yNorm: number) {
    const el = ref.current;
    if (!el) return;
    const wd =
      effectiveMinWidth +
      xNorm * (effectiveMaxWidth - effectiveMinWidth);
    const sl =
      effectiveMinSlant +
      yNorm * (effectiveMaxSlant - effectiveMinSlant);
    el.style.fontVariationSettings = `"wdth" ${wd.toFixed(
      1
    )}, "slnt" ${sl.toFixed(1)}`;
  }

  // 1) Desktop: pointer + (optionally) deviceorientation
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isMobile()) return; // ❗ Mobile handled separately

    const el = ref.current;
    if (!el) return;

    let orientationFrameId: number | null = null;

    const onPointerMove = (e: PointerEvent) => {
      // Capture coordinates immediately (event object is reused by the browser)
      const x = e.clientX;
      const y = e.clientY;
      // Throttle to one update per animation frame — prevents Mac trackpad's
      // high-frequency events from restarting the CSS transition on every tick.
      if (rafId.current !== null) cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(() => {
        rafId.current = null;
        const xNorm = clamp(x / window.innerWidth, 0, 1);
        const yNorm = clamp(y / window.innerHeight, 0, 1);
        applyAxesFromNorm(xNorm, yNorm);
      });
    };

    window.addEventListener("pointermove", onPointerMove);

    // Device orientation handler (desktop / tablets that support it)
    let onDeviceOrientation: ((e: DeviceOrientationEvent) => void) | null =
      null;
    if (enableTilt && tiltAllowed) {
      onDeviceOrientation = (e: DeviceOrientationEvent) => {
        const gamma = e.gamma ?? 0;
        const beta = e.beta ?? 0;
        const xNorm = clamp((gamma + 45) / 90, 0, 1);
        const yNorm = clamp((beta + 45) / 90, 0, 1);
        applyAxesFromNorm(xNorm, yNorm);
      };
      window.addEventListener("deviceorientation", onDeviceOrientation);
    }

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      if (rafId.current !== null) cancelAnimationFrame(rafId.current);
      if (onDeviceOrientation) {
        if (orientationFrameId) cancelAnimationFrame(orientationFrameId);
        window.removeEventListener("deviceorientation", onDeviceOrientation);
      }
    };
  }, [
    enableTilt,
    tiltAllowed,
    effectiveMinWidth,
    effectiveMaxWidth,
    effectiveMinSlant,
    effectiveMaxSlant,
  ]);

  // 2) Prompt for permission (desktop/tablet only now)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isMobile()) {
      // On mobile we're using tap-random, not tilt
      setTiltAllowed(false);
      setPermissionDenied(true);
      return;
    }

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

  // 3) Fallback on denial or timeout (desktop only, but **no** auto-animate now)
  useEffect(() => {
    if (!enableTilt) return;
    if (typeof window === "undefined") return;
    if (isMobile()) return; // mobile uses tap-random now

    let timer: NodeJS.Timeout;
    if (!tiltAllowed && !permissionDenied) {
      timer = setTimeout(() => setPermissionDenied(true), permissionTimeout);
    }
    return () => clearTimeout(timer as any);
  }, [enableTilt, tiltAllowed, permissionDenied, permissionTimeout]);

  // 4) Mobile: random switches on tap (anywhere)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isMobile()) return;

    const handleTap = () => {
      const xNorm = Math.random();
      const yNorm = Math.random();
      applyAxesFromNorm(xNorm, yNorm);
    };

    window.addEventListener("pointerdown", handleTap);
    return () => {
      window.removeEventListener("pointerdown", handleTap);
    };
  }, [
    effectiveMinWidth,
    effectiveMaxWidth,
    effectiveMinSlant,
    effectiveMaxSlant,
  ]);

  // 5) External trigger from parent (used by TraitDresser on mobile)
  useEffect(() => {
    if (randomizeOnMobileKey === undefined) return;
    if (typeof window === "undefined") return;
    if (!isMobile()) return;

    const xNorm = Math.random();
    const yNorm = Math.random();
    applyAxesFromNorm(xNorm, yNorm);
  }, [
    randomizeOnMobileKey,
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
        // Mobile: skip the CSS transition entirely — taps are discrete events and
        // the intermediate rasterized frames cause trail artifacts on mobile GPUs.
        transition: isMobileDevice ? "none" : `font-variation-settings ${transitionDuration}s ease`,
        // Force a compositing layer so repaints are isolated to this element,
        // preventing old pixels from bleeding into the surrounding composite.
        willChange: "transform",
        transform: "translateZ(0)",
      }}
      {...rest}
    >
      {children}
    </Heading>
  );
}
