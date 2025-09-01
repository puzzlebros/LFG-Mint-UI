// components/LogoImage.tsx
import React from "react";
import { chakra, Box, Image as ChakraImage } from "@chakra-ui/react";
import { motion, useAnimation, AnimationControls, Variants } from "framer-motion";

// Motion-wrapped containers and image
const MotionBox = chakra(motion.div);
const MotionOverlay = motion(Box);
const MotionImage = chakra(motion.img);

export type LogoImageProps = {
  src: string;
  alt?: string;
  boxSize?: string;
  /** Duration in seconds for one full shine pass */
  glowDuration?: number;
  /** Delay in seconds between shine repeats */
  glowDelay?: number;
};

const LogoImage: React.FC<LogoImageProps> = ({
  src,
  alt = "Logo",
  boxSize = "50px",
  glowDuration = 1,
  glowDelay = 3,
}) => {
  const controls: AnimationControls = useAnimation();

  // Variants for subtle diagonal shine
  const overlayVariants: Variants = {
    hidden: {
      backgroundPosition: ["-100% 0%", "-100% 0%"],
    },
    glow: {
      backgroundPosition: ["-100% 0%", "200% 0%"],
      transition: {
        repeat: Infinity,
        repeatType: "loop",
        duration: glowDuration,
        repeatDelay: glowDelay,
        ease: "linear",
      },
    },
  };

  const handleHoverStart = () => controls.start("glow");
  const handleHoverEnd = () => controls.start("hidden");

  return (
    <MotionBox
      position="relative"
      display="inline-block"
      boxSize={boxSize}
      verticalAlign="middle"
      onHoverStart={handleHoverStart}
      onHoverEnd={handleHoverEnd}
      whileHover={{ scale: 1.2 }}
      // @ts-ignore: use Framer Motion transition
      transition={{ duration: 0.2 } as any}
      overflow="hidden"
    >
      <MotionImage
        src={src}
        alt={alt}
        boxSize="100%"
        objectFit="contain"
        userSelect="none"
        pointerEvents="none"
      />

      {/* Subtle diagonal shine line */}
      <MotionOverlay
        position="absolute"
        inset={0}
        pointerEvents="none"
        bgImage="linear-gradient(45deg, transparent 45%, rgba(255,255,255,0.6) 50%, transparent 55%)"
        backgroundRepeat="no-repeat"
        backgroundSize="200% 100%"
        variants={overlayVariants}
        initial="hidden"
        animate={controls}
      />
    </MotionBox>
  );
};

export default LogoImage;
