// components/InteractiveHeading.tsx
import { Heading, HeadingProps, useToast } from "@chakra-ui/react";
import { useRef, useEffect, useState, MouseEvent } from "react";

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
  previewWidth?: number;
  previewSlant?: number;
  transitionDuration?: number;
  enableTilt?: boolean;
  /** how long to wait for a tilt-permission response (ms) */
  permissionTimeout?: number;
}

export default function InteractiveHeading({
  children,
  minWidth            = 26,
  maxWidth            = 146,
  minSlant           = -15,
  maxSlant            = 15,
  previewWidth        = (26 + 146) / 2,
  previewSlant        = 0,
  transitionDuration  = 0.3,
  enableTilt          = true,
  permissionTimeout   = 5000,         // ← default 5s

  fontSize       = "6xl",
  letterSpacing  = "0.2em",
  lineHeight     = "1.1",
  ...rest
}: InteractiveHeadingProps) {
  const ref = useRef<HTMLHeadingElement>(null);
  const toast = useToast();

  // track if tilt was ever allowed or denied
  const [tiltAllowed, setTiltAllowed]         = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  // 1) Core: pointer + deviceorientation (if allowed)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const updateAxes = (xNorm: number, yNorm: number) => {
      const wd = minWidth + xNorm * (maxWidth - minWidth);
      const sl = minSlant + yNorm * (maxSlant - minSlant);
      el.style.fontVariationSettings = 
        `"wdth" ${wd.toFixed(1)}, "slnt" ${sl.toFixed(1)}`;
    };

    const onPointerMove = (e: PointerEvent) => {
      updateAxes(clamp(e.clientX / window.innerWidth, 0, 1),
                 clamp(e.clientY / window.innerHeight,0, 1));
    };
    window.addEventListener("pointermove", onPointerMove);

    let onDeviceOrientation: ((e: DeviceOrientationEvent) => void) | null = null;
    if (enableTilt && tiltAllowed) {
      onDeviceOrientation = (e) => {
        const gamma = e.gamma ?? 0;
        const beta  = e.beta  ?? 0;
        updateAxes(
          clamp((gamma + 45) / 90, 0, 1),
          clamp((beta  + 45) / 90, 0, 1)
        );
      };
      window.addEventListener("deviceorientation", onDeviceOrientation);
    }

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      if (onDeviceOrientation) {
        window.removeEventListener("deviceorientation", onDeviceOrientation);
      }
    };
  }, [minWidth, maxWidth, minSlant, maxSlant, enableTilt, tiltAllowed]);

  // 2) Prompt for permission on first tap (iOS)
  useEffect(() => {
    const el = ref.current;
    const devOrient = (DeviceOrientationEvent as any);

    if (enableTilt && typeof devOrient?.requestPermission === "function") {
      const handleTap = (e: MouseEvent) => {
        devOrient.requestPermission()
          .then((perm: string) => {
            if (perm === "granted") {
              setTiltAllowed(true);
              toast({ title:"Tilt enabled", status:"success", duration:2000 });
            } else {
              setPermissionDenied(true);
              toast({ title:"Tilt denied", status:"warning", duration:2000 });
            }
          })
          .catch(() => {
            setPermissionDenied(true);
            toast({ title:"Tilt error", status:"error", duration:2000 });
          });
        el?.removeEventListener("pointerdown", handleTap as any);
      };

      toast({ title:"Tap heading to enable tilt", status:"info", duration:3000 });
      el?.addEventListener("pointerdown", handleTap as any);
    } else {
      // not iOS 13+ or no API → treat as allowed
      setTiltAllowed(true);
    }
  }, [enableTilt, toast]);

  // 3) Fallback on explicit denial OR on no response within timeout
  useEffect(() => {
    if (!enableTilt) return;

    let timer: NodeJS.Timeout|number;
    // start timeout if we haven't got a grant/deny yet
    if (!tiltAllowed && !permissionDenied) {
      timer = setTimeout(() => {
        setPermissionDenied(true);
        toast({ title:"Auto-animating heading", status:"info", duration:2000 });
      }, permissionTimeout);
    }

    return () => {
      clearTimeout(timer as any);
    };
  }, [enableTilt, tiltAllowed, permissionDenied, permissionTimeout, toast]);

  // 4) Auto-animate when permissionDenied === true
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
        const wd = minWidth + xNorm * (maxWidth - minWidth);
        const sl = minSlant + yNorm * (maxSlant - minSlant);
        ref.current.style.fontVariationSettings = 
          `"wdth" ${wd.toFixed(1)}, "slnt" ${sl.toFixed(1)}`;
      }
      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [enableTilt, permissionDenied, minWidth, maxWidth, minSlant, maxSlant]);

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
        transition:            `font-variation-settings ${transitionDuration}s ease`,
      }}
      {...rest}
    >
      {children}
    </Heading>
  );
}
