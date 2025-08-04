// components/CongratsPopup.tsx
import React from "react";
import { Button, Link as ChakraLink, Text } from "@chakra-ui/react";
import ThemedModal from "./ThemedModal";
import NextLink from "next/link";

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
      footer={
        <>
          <NextLink href="/mint" passHref legacyBehavior>
            <ChakraLink>
              <Button colorScheme="purple" variant="primary">
                CLAIM NOW!
              </Button>
            </ChakraLink>
          </NextLink>
        </>
      }
    >
      {children ?? (
        <Text textAlign="center" fontSize="md">
          You made it into the <strong>TOP 10</strong> during claim day.
          <br />
          Claim your free mint now and enjoy your victory!
        </Text>
      )}
    </ThemedModal>
  );
}
