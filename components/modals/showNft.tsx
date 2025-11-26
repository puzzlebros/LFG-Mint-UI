import { JsonMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { PublicKey } from "@metaplex-foundation/umi";
import {
  Box,
  Text,
  SimpleGrid,
  useTheme,
  Flex,
} from "@chakra-ui/react";
import React from "react";

interface TraitProps {
  heading: string;
  description: string;
}

interface TraitsProps {
  metadata: JsonMetadata;
}

const Trait = ({ heading, description }: TraitProps) => {
  const theme = useTheme();
  return (
    <Box
      bg={theme.colors.brand.LightPurple}
      borderRadius={0}
      width="full"
      minH="40px"
      px={3}
      py={2}
      display="flex"
      justifyContent="space-between"
      alignItems="center"
      mb={2}
      fontFamily={theme.fonts.body}
      fontSize="sm"
      color={theme.colors.brand.DarkPurple}
      userSelect="none"
    >
      <Text
        textTransform="uppercase"
        flex="1"
        textAlign="left"
        fontWeight="normal"
        minW={0}
        isTruncated
        pr={2}
      >
        {heading}
      </Text>
      <Text
        flex="1"
        textAlign="right"
        fontWeight="semibold"
        minW={0}
        isTruncated
        pl={2}
      >
        {description}
      </Text>
    </Box>
  );
};

const Traits = ({ metadata }: TraitsProps) => {
  if (!metadata?.attributes) {
    return null;
  }

  const traits = metadata.attributes.filter(
    (a) => a.trait_type !== undefined && a.value !== undefined
  );

  return (
    <Box mt={4}>
      {traits.map((t) => (
        <Trait
          key={t.trait_type}
          heading={t.trait_type ?? ""}
          description={t.value ?? ""}
        />
      ))}
    </Box>
  );
};

export default function ShowNft({
  nfts,
}: {
  nfts?: { mint: PublicKey; offChainMetadata?: JsonMetadata }[];
}) {
  const theme = useTheme();

  if (!nfts || nfts.length === 0) return null;

  const nft = nfts[0];
  const metadata = nft.offChainMetadata;
  if (!metadata) return null;

  const image = metadata.animation_url ?? metadata.image;

  return (
    <SimpleGrid
      templateColumns={{ base: "1fr", md: "60% 40%" }}
      spacing={{ base: 2, md: 6 }}
      p={6}
      w="full"
      color={theme.colors.brand.DarkPurple}
      fontFamily={theme.fonts.body}
      minH="400px"
      height="100%"
      alignItems="stretch"
    >
      {/* Left column - Image wrapper */}
      <Flex
        w="100%"
        h="100%"
        overflow="hidden"
        alignItems="center"
        justifyContent="center"
      >
        <img
          src={image}
          alt={metadata.name ?? "NFT image"}
          style={{
            height: "100%",
            width: "auto",
            objectFit: "contain",
            display: "block",
          }}
          draggable={false}
        />
      </Flex>

      {/* Right column - Text content */}
      <Box
        w="100%"
        h="100%"
        display="flex"
        flexDirection="column"
        // Add the same horizontal padding as the grid for even margins
        px={{ base: 0, md: 6 }}
      >
        <Text
          fontFamily={theme.fonts.heading}
          textStyle="condensed"
          fontSize="2.7rem"
          color={theme.colors.brand.Pink}
          userSelect="text"
  whiteSpace={{ base: "normal", md: "nowrap" }}  // wrap on mobile, keep nowrap on desktop
          textTransform="uppercase"
        >
          {metadata.name ?? "Unnamed NFT"}
        </Text>

        <Text
          fontFamily={theme.fonts.body}
          fontSize="md"
          color={theme.colors.brand.DarkPurple}
          mb={3}
          userSelect="text"
          whiteSpace="pre-wrap"
          flexShrink={0}
        >
          {metadata.description ?? "No description available."}
        </Text>

        <Box flexGrow={1} overflowY="auto">
          <Traits metadata={metadata} />
        </Box>
      </Box>
    </SimpleGrid>
  );
}
