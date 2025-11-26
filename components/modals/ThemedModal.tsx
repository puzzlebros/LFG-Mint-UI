import React from "react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  ModalFooter,
  useTheme,
  ModalProps,
} from "@chakra-ui/react";
import type {
  ModalHeaderProps,
  ModalBodyProps,
  ModalFooterProps,
} from "@chakra-ui/react";

interface ThemedModalProps extends ModalProps {
  title: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  /** Optional per-modal header text styles/props */
  headerProps?: ModalHeaderProps;
  /** Optional per-modal body text styles/props */
  bodyProps?: ModalBodyProps;
  /** Optional per-modal footer props (spacing, alignment, etc.) */
  footerProps?: ModalFooterProps;
}

export default function ThemedModal({
  title,
  footer,
  children,
  headerProps,
  bodyProps,
  footerProps,
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
      <ModalOverlay bg="blackAlpha.600" backdropFilter="blur(4px)" />

      <ModalContent
        bg={theme.colors.brand.White}
        color={theme.colors.brand.DarkPurple}
        boxShadow="xl"
        borderRadius={0}
        maxW={{ base: "90vw", sm: "500px", md: "600px" }}
        p={7}
      >
        <ModalHeader
          fontFamily={theme.fonts.heading}
          textStyle="condensed"
          textAlign="center"
          userSelect="none"
          {...headerProps}   // <- per-popup overrides
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
          whiteSpace="pre-wrap"
          {...bodyProps}     // <- per-popup overrides
        >
          {children}
        </ModalBody>

        {footer && (
          <ModalFooter
            justifyContent="center"
            px={0}
            {...footerProps} // <- per-popup overrides
          >
            {footer}
          </ModalFooter>
        )}
      </ModalContent>
    </Modal>
  );
}
