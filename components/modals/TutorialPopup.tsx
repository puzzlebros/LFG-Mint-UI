import React, { useState, useEffect } from "react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Button,
  Box,
  Flex,
  Text,
  Image,
  useTheme,
  useBreakpointValue,
  HStack,
} from "@chakra-ui/react";

const TUTORIAL_STORAGE_KEY = "gameTutorialShown";

const tutorialSteps = [
  {
    title: "LEARN TO FLY",
    content:
      "Climb as high as you can! Collect feathers to gain special abilities and climb faster.",
    image: "/images/tutorial/1.png",
  },
  {
    title: "DEFEAT THE FUD",
    content:
      "You can stomp on the FUD that gets in your way for extra points.",
    image: "/images/tutorial/2.png",
  },
  {
    title: "CLAIM REWARDS",
    content:
      "Rank into the top 10 scores to claim your FREE weekly reward. Good luck and have fun!",
    image: "/images/tutorial/3.png",
  },
];

type TutorialPopupProps = {
  onCloseExternal?: () => void;
};

export default function TutorialPopup({ onCloseExternal }: TutorialPopupProps) {
  const theme = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const shownBefore = localStorage.getItem(TUTORIAL_STORAGE_KEY);
    if (!shownBefore) setIsOpen(true);
  }, []);

  const closeModal = () => {
    setIsOpen(false);
    localStorage.setItem(TUTORIAL_STORAGE_KEY, "true");
    if (onCloseExternal) onCloseExternal();
  };

  const nextStep = () => {
    if (stepIndex + 1 >= tutorialSteps.length) closeModal();
    else setStepIndex((i) => i + 1);
  };

  const currentStep = tutorialSteps[stepIndex];

  return (
    <Modal isOpen={isOpen} onClose={closeModal} size="xl" isCentered>
      <ModalOverlay />
      <ModalContent
        maxW="500px"
        p={0}
        bg={theme.colors.brand.White}
        color={theme.colors.brand.DarkPurple}
        borderRadius={0}
        boxShadow="md"
      >
        <ModalCloseButton />
        <ModalBody px={0} pt={8} pb={0}>
          <Flex direction="column" align="center" textAlign="center">
            {/* Image at top */}
            {currentStep.image && (
              <Image
                src={currentStep.image}
                alt={currentStep.title}
                maxW="250px"
                mb={2}
                userSelect="none"
                mx="auto"
                borderRadius={0}
                boxShadow="none"
              />
            )}

            {/* Title */}
            <Text
              fontFamily={theme.fonts.heading}
              textStyle="narrow"
              fontSize="2rem"
              mt={2}
              mb={2}
              textAlign="center"
              textTransform="uppercase"
            >
              {currentStep.title}
            </Text>

            {/* Description */}
            <Text
              fontFamily={theme.fonts.body}
              fontSize="md"
              color={theme.colors.brand.DarkPurple}
              lineHeight="1.3"
              maxW="90%"
              mx="auto"
              mb={6}
            >
              {currentStep.content}
            </Text>

            {/* Dots below description */}
            <HStack spacing={2} justify="center" mt={-2} mb={2}>
              {tutorialSteps.map((_, idx) => (
                <Box
                  key={idx}
                  w="7px"
                  h="7px"
                  borderRadius="full"
                  bg={
                    idx === stepIndex
                      ? theme.colors.brand.Purple
                      : "gray.300"
                  }
                  opacity={idx === stepIndex ? 1 : 0.45}
                  transition="background 0.2s"
                />
              ))}
            </HStack>
          </Flex>
        </ModalBody>
        <ModalFooter justifyContent="center" pb={6} pt={0}>
          <Button
            color="white"
            bg={theme.colors.brand.Purple}
            _hover={{ bg: theme.colors.brand.BrightPurple }}
            _active={{ bg: theme.colors.brand.DarkPurple }}
            borderRadius={0}
            fontWeight="extrabold"
            w="80%"
            mx="auto"
            fontSize="lg"
            onClick={nextStep}
          >
            {stepIndex + 1 === tutorialSteps.length ? "LET'S GO!" : "NEXT"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
