// pages/faq.tsx
import { NextPage } from "next";
import React, { useRef, useState, useEffect } from "react";
import {
  Box,
  Heading,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  Text,
  Image,
  Icon,
} from "@chakra-ui/react";
import { AddIcon } from "@chakra-ui/icons";
import { keyframes } from "@emotion/react";
import { Footer } from "../components/Footer";
import { faqs } from "../public/data/faq";

const NAVBAR_HEIGHT = 60; // px — adjust to match your navbar’s height

// float up/down keyframes
const floatAnim = keyframes`
  0%,100% { transform: translateY(0); }
  50%     { transform: translateY(-20px); }
`;

const Islands = [
  { src: "/images/islands/Island_1.png", top: "25%", left: "7%",  delay: "0s",   size: "100px" },
  { src: "/images/islands/Island_2.png", top: "35%", left: "80%", delay: "1s",   size: "120px" },
  { src: "/images/islands/Island_3.png", top: "55%", left: "10%", delay: "0.5s", size: "180px" },
  { src: "/images/islands/Island_4.png", top: "60%", left: "85%", delay: "1.5s", size: "75px"  },
];

const FAQPage: NextPage = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDims({ w: width, h: height });
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return (
    <Box
      ref={containerRef}
      display="flex"
      flexDirection="column"
      height="100vh"
      bg="white"
      position="relative"
      overflow="hidden"
    >
      {/* Floating islands behind */}
      {dims.h > 0 &&
        Islands.map(({ src, top, left, delay, size }, i) => (
          <Box
            key={i}
            position="absolute"
            top={top}
            left={left}
            animation={`${floatAnim} 4s ease-in-out ${delay} infinite`}
            zIndex={0}
            pointerEvents="none"
          >
            <Image
              src={src}
              boxSize={size}
              objectFit="contain"
              alt={`island-${i}`}
            />
          </Box>
        ))}

      {/* Scrollable FAQ content */}
      <Box
        as="main"
        flex="1"
        pt={`${NAVBAR_HEIGHT}px`}
        px={4}
        position="relative"
        zIndex={1}
        overflowY="auto"
        sx={{
          "&::-webkit-scrollbar": { display: "none" },
          scrollbarWidth: "none",
        }}
      >
        <Box maxW="800px" mx="auto" py={8}>
          <Heading
            as="h1"
            size="xl"
            mt="45px"
            mb="55px"
            fontSize="3rem"
            textStyle="condensed"
            textAlign="center"
          >
            FREQUENTLY ASKED QUESTIONS
          </Heading>

          <Accordion allowMultiple>
            {faqs.map(({ question, answer }, idx) => (
              <AccordionItem key={idx} border="none" mb={2}>
                {({ isExpanded }) => (
                  <>
                    <AccordionButton
                      _expanded={{
                        bgGradient: "linear(to-r, gray.100, transparent)",
                      }}
                      px={4}
                      py={3}
                      // remove any rounding
                      borderRadius="0"
                    >
                      <Box
                        flex="1"
                        textAlign="left"
                        fontWeight="semibold"
                        color={
                          isExpanded ? "brand.Purple" : "brand.DarkPurple"
                        }
                      >
                        {question}
                      </Box>
                      <Icon
                        as={AddIcon}
                        w={3}
                        h={3}
                        color={
                          isExpanded ? "brand.Purple" : "brand.DarkPurple"
                        }
                        transform={isExpanded ? "rotate(45deg)" : "rotate(0deg)"}
                        transition="transform 0.2s"
                      />
                    </AccordionButton>
                    <AccordionPanel
                      px={4}
                      py={3}
                      // same gradient and no rounding
                      bgGradient={
                        isExpanded
                          ? "linear(to-r, gray.100, transparent)"
                          : undefined
                      }
                      borderRadius="0"
                    >
                      <Text whiteSpace="pre-line">{answer}</Text>
                    </AccordionPanel>
                  </>
                )}
              </AccordionItem>
            ))}
          </Accordion>
        </Box>
      </Box>

      {/* Footer pinned at bottom */}
      <Box flexShrink={0}>
        <Footer />
      </Box>
    </Box>
  );
};

export default FAQPage;
