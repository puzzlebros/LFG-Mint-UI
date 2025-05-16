import React from "react";
import { chakra } from "@chakra-ui/react";
import { motion } from "framer-motion";

// Wrap a native img element with Chakra and Framer Motion.
const MotionImage = chakra(motion.img);

export type LogoImageProps = {
  src: string;
  alt?: string;
  boxSize?: string;
};

const LogoImage: React.FC<LogoImageProps> = ({
  src,
  alt = "Logo",
  boxSize = "50px",
}) => {
  return (
    <MotionImage
      src={src}
      alt={alt}
      boxSize={boxSize}
      objectFit="contain"
      // Apply a simple hover scaling effect with transition.
      whileHover={{ scale: 1.3, transition: { duration: 0.2 } as any }}
    />
  );
};

export default LogoImage;
