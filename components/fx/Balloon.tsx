// components/Balloon.tsx
import React, { useState, useEffect } from 'react'
import { Image } from '@chakra-ui/react'
import { keyframes } from '@emotion/react'

/**
 * rise keyframes: spawn off-screen bottom → float → exit off-screen top
 */
const rise = keyframes`
  0% {
    top: 110vh;
    opacity: 0;
    transform: scale(var(--scale));
  }
  10% {
    opacity: 1;
  }
  90% {
    opacity: 1;
  }
  100% {
    top: -110vh;
    opacity: 0;
    transform: scale(var(--scale));
  }
`

interface BalloonProps {
  /** image source */
  src: string
  /** size range (scale) default 0.8→1.2 */
  minScale?: number
  maxScale?: number
  /** rise duration range in seconds default 10→20 */
  minDuration?: number
  maxDuration?: number
  /** threshold above which balloon renders above others */
  highScaleThreshold?: number
  /** z-index for "big" balloons */
  highScaleZIndex?: number
}

export default function Balloon({
  src,
  minScale = 0.7,
  maxScale = 2.7,
  minDuration = 10,
  maxDuration = 20,
  highScaleThreshold,
  highScaleZIndex = 2,
}: BalloonProps) {
  /**
   * Generate a fresh config for each rise animation, including random horizontal position,
   * scale, duration, and computed zIndex based on scale threshold.
   */
  const getConfig = () => {
    const leftVW    = Math.random() * 100           // anywhere 0vw→100vw
    const durSec    = minDuration + Math.random() * (maxDuration - minDuration)
    const scale     = minScale + Math.random() * (maxScale - minScale)
    const threshold = highScaleThreshold ?? ((minScale + maxScale) / 2)
    const zIndex    = scale > threshold ? highScaleZIndex : 0

    return {
      left:     `${leftVW}vw`,        
      scale,                        
      duration: `${durSec}s`,       
      zIndex,                       
    }
  }

  const [cfg, setCfg] = useState(getConfig)

  // After each rise completes, re-generate config to re-render and restart animation
  useEffect(() => {
    const ms = parseFloat(cfg.duration) * 1000
    const id = window.setTimeout(() => setCfg(getConfig()), ms)
    return () => clearTimeout(id)
  }, [cfg])

  return (
    <Image
      key={`${cfg.left}-${cfg.scale}-${cfg.duration}`}
      src={src}
      position="absolute"
      left={cfg.left}
      pointerEvents="none"
      boxSize="80px"
      objectFit="contain"
      sx={{
        '--scale':  cfg.scale,
        transform:  'scale(var(--scale))',
        opacity:    0,
        animation:  `${rise} ${cfg.duration} linear`,
        animationFillMode: 'forwards',
        willChange: 'top, opacity',
        zIndex:     cfg.zIndex,
      } as any}
    />
  )
}
