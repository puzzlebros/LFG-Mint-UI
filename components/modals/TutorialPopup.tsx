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
  useTheme,
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
        maxW={{ base: "96vw", md: "500px" }}
        maxH={{ base: "60vh", md: "570px" }}
        bg={theme.colors.brand.White}
        color={theme.colors.brand.DarkPurple}
        borderRadius={0}
        boxShadow="md"
        position="relative"
        overflow="hidden"
        p={0}
        display="flex"
        flexDirection="column"
        justifyContent="flex-end"
      >
        <ModalCloseButton zIndex={2} color={theme.colors.brand.DarkPurple} />

        {/* Background image/video fills the whole modal */}
        <Box
          position="absolute"
          top={0}
          left={0}
          width="100%"
          height="100%"
          zIndex={0}
          display="flex"
          alignItems="center"
          justifyContent="center"
          pointerEvents="none"
          // Remove opacity for normal image display
        >
          {currentStep.image && (
            <img
              src={currentStep.image}
              alt={currentStep.title}
              style={{
                height: "100%",
                width: "auto",
                objectFit: "contain",
                display: "block",
                margin: "0 auto",
                // Remove or tweak opacity if you don't want transparency
                opacity: 1,
                pointerEvents: "none",
                userSelect: "none",
              }}
              draggable={false}
            />
          )}
        </Box>

        {/* Foreground content */}
        <ModalBody
          px={{ base: 2, md: 8 }}
          py={0}
          zIndex={1}
          display="flex"
          flexDirection="column"
          justifyContent="flex-end"
          alignItems="center"
          height="100%"
          minH={{ base: "70vh", md: "600px" }}
        >
          <Flex
            direction="column"
            align="center"
            justify="flex-end"
            textAlign="center"
            w="full"
            h="100%"
            pt={{ base: "60%", md: "55%" }} // push content to lower half
            pb={0}
            position="relative"
          >
            <Text
              fontFamily={theme.fonts.heading}
              textStyle="narrow"
              fontSize="2rem"
              mt={2}
              mb={2}
              textAlign="center"
              textTransform="uppercase"
              color={theme.colors.brand.DarkPurple}
              zIndex={1}
              fontWeight="extrabold"
            >
              {currentStep.title}
            </Text>
            <Text
              fontFamily={theme.fonts.body}
              fontSize="md"
              color={theme.colors.brand.DarkPurple}
              lineHeight="1.3"
              maxW="90%"
              mx="auto"
              mb={6}
              zIndex={1}
            >
              {currentStep.content}
            </Text>
          </Flex>
        </ModalBody>
        <ModalFooter
          justifyContent="center"
          pb={6}
          pt={0}
          zIndex={1}
          flexDirection="column"
          bg="transparent"
        >
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
            mb={4}
            zIndex={1}
          >
            {stepIndex + 1 === tutorialSteps.length ? "LET'S GO!" : "NEXT"}
          </Button>
          {/* Dots below the button */}
          <HStack spacing={2} justify="center" mb={0}>
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
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
