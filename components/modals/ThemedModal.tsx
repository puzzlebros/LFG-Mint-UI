import React from "react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  ModalFooter,
  Button,
  useTheme,
  ModalProps,
} from "@chakra-ui/react";

interface ThemedModalProps extends ModalProps {
  title: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

export default function ThemedModal({
  title,
  footer,
  children,
  ...modalProps
}: ThemedModalProps) {
  const theme = useTheme();

  return (
    <Modal
      {...modalProps}
      isCentered
      motionPreset="scale"
      autoFocus
      trapFocus
      closeOnEsc
      closeOnOverlayClick
    >
      <ModalOverlay
        bg="blackAlpha.600"
        backdropFilter="blur(4px)"
      />
      <ModalContent
        bg={theme.colors.brand.White}
        color={theme.colors.brand.DarkPurple}
        boxShadow="xl"
        borderRadius={0}
        maxW={{ base: "90vw", sm: "500px", md: "600px" }}
        p={6}
      >
        <ModalHeader
          fontFamily={theme.fonts.heading}
          textStyle="narrow"
          fontSize={{ base: "3rem", md: "2.3rem" }}
          textAlign="center"
          userSelect="none"
          mt={3}
        >
          {title}
        </ModalHeader>
        <ModalCloseButton
          _focus={{ boxShadow: "none" }}
          aria-label="Close modal"
        />
        <ModalBody
          fontFamily={theme.fonts.body}
          fontSize={{ base: "md", md: "lg" }}
          textAlign="center"
          color={theme.colors.brand.DarkPurple}
          mb={footer ? 1 : 0}
                    mt={-3}

          whiteSpace="pre-wrap"
        >
          {children}
        </ModalBody>
        {footer && (
          <ModalFooter justifyContent="center" px={0}           mt={3}
>
            {footer}
          </ModalFooter>
        )}
      </ModalContent>
    </Modal>
  );
}
