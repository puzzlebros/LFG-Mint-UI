// components/CongratsPopup.tsx
import React from "react";
import { Button, Link as ChakraLink, Text } from "@chakra-ui/react";
import ThemedModal from "./ThemedModal";
import NextLink from "next/link";
import { keyframes } from "@emotion/react";

const pulseClaim = keyframes`
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(108, 0, 255, 0.7);
  }
  70% {
    transform: scale(1.04);
    box-shadow: 0 0 0 16px rgba(108, 0, 255, 0);
  }
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(108, 0, 255, 0);
  }
`;

interface CongratsPopupProps {
  isOpen: boolean;
  onClose: () => void;
  children?: React.ReactNode;
}

export default function CongratsPopup({ isOpen, onClose, children }: CongratsPopupProps) {
  return (
    <ThemedModal
      isOpen={isOpen}
      onClose={onClose}
      title="CONGRATULATIONS!"
          headerProps={{
    fontSize: { base: "2.6rem", md: "3.5rem" },
    lineHeight: { base: "2rem", md: "3rem" },
  }}
  bodyProps={{
    fontSize: { base: "1rem", md: "1.2rem" },
        lineHeight: { base: "1.3rem", md: "1.7rem" },
  }}
      footer={
        <>
          <NextLink href="/mint" passHref legacyBehavior>
            <ChakraLink>
              <Button
              colorScheme="purple"
              variant="primary"
              animation={`${pulseClaim} 1.6s ease-in-out infinite`}
              >
                CLAIM NOW!
              </Button>
            </ChakraLink>
          </NextLink>
        </>
      }
    >
      {children ?? (
        <Text textAlign="center">
          You made it into the <strong>TOP 10</strong> during claim day.
          <br />
          Claim your free mint now and enjoy your victory!
        </Text>
      )}
    </ThemedModal>
  );
}
