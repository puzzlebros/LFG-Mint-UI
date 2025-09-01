//components/ParallaxImage.tsx
import React from "react";
import { Box } from "@chakra-ui/react";
import { Parallax } from "react-scroll-parallax";

export type ParallaxImageProps = {
  src: string;
  alt?: string;
  /**
   * Determines the initial horizontal translation.
   * For "left": animates from -50px to 0px; 
   * for "right": from 50px to 0;
   * for "center": no horizontal translation.
   */
  position?: "left" | "right" | "center";
  width?: string; // custom width (default "300px")
};

const ParallaxImage: React.FC<ParallaxImageProps> = ({
  src,
  alt,
  position = "center",
  width = "300px",
}) => {
  // Determine horizontal translation range based on position.
  let translateXRange: [number, number] = [0, 0];
  if (position === "left") {
    translateXRange = [-50, 0];
  } else if (position === "right") {
    translateXRange = [50, 0];
  } else {
    translateXRange = [0, 0];
  }

  // Outer container to center the parallax image in its section.
  const containerStyle: React.CSSProperties = {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)", // centers the container
    width: width,
    zIndex: 10, // ensure the image appears above section background
  };

  return (
    <Box style={containerStyle}>
      <Parallax translateX={translateXRange} opacity={[0.5, 1]}>
        <img
          src={src}
          alt={alt}
          style={{ width: "100%", height: "auto", display: "block" }}
        />
      </Parallax>
    </Box>
  );
};

export default ParallaxImage;
