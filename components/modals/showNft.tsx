import { JsonMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { PublicKey } from "@metaplex-foundation/umi";
import {
  Box,
  Text,
  Flex,
  Button,
  Icon,
  useTheme,
} from "@chakra-ui/react";
import { SiX } from "react-icons/si";
import React from "react";
import { mintCompletions } from "@/public/data/mintMessages";

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
      minH="36px"
      px={3}
      py={1}
      display="flex"
      justifyContent="space-between"
      alignItems="center"
      mb={1}
      fontFamily={theme.fonts.body}
      fontSize="sm"
      color={theme.colors.brand.DarkPurple}
      userSelect="none"
    >
      <Text
        fontFamily={theme.fonts.body}
        fontSize="sm"
        fontWeight={400}
        lineHeight={1}
        letterSpacing={0}
        textTransform="uppercase"
        flex="1"
        textAlign="left"
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
  if (!metadata?.attributes) return null;

  const traits = metadata.attributes.filter(
    (a) => a.trait_type !== undefined && a.value !== undefined
  );

  return (
    <>
      {traits.map((t) => (
        <Trait
          key={t.trait_type}
          heading={t.trait_type ?? ""}
          description={t.value ?? ""}
        />
      ))}
    </>
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

  const rawImage = metadata.animation_url ?? metadata.image;
  const image = rawImage?.startsWith("ipfs://")
    ? rawImage.replace("ipfs://", "https://dweb.link/ipfs/")
    : rawImage;

  const completion = mintCompletions[Math.floor(Math.random() * mintCompletions.length)] ?? "LFG.";
  const shareText = encodeURIComponent(
    `I just minted this @LetsFlamingoNFT because I believe ${completion}\n#Solana`
  );
  // Include the NFT image URL so X unfurls it as a card in the tweet
  const shareUrl = `https://x.com/intent/tweet?text=${shareText}&url=${encodeURIComponent(image ?? "")}`;

  return (
    // Outer Box: p={6} on all sides → equal outer margins from modal edge.
    // CSS Grid: image column's natural height drives the row height;
    // the right column stretches to exactly match it via align-items: stretch.
    <Box
      p={6}
      w="full"
      display={{ base: "block", md: "grid" }}
      gridTemplateColumns={{ md: "58% 1fr" }}
      gap={6}
      color={theme.colors.brand.DarkPurple}
      fontFamily={theme.fonts.body}
    >
      {/* ── Image column ──
          width: 100%, height: auto → the image's natural aspect ratio
          determines the row height. objectFit/position not needed here
          because the element is already sized to its natural proportions. */}
      <Box overflow="hidden">
        <img
          src={image}
          alt={metadata.name ?? "NFT image"}
          style={{ width: "100%", height: "auto", display: "block" }}
          draggable={false}
        />
      </Box>

      {/* ── Right column ──
          align-self: stretch gives it the same height as the image column.
          That height is "definite" in CSS Grid, so flex children can use flex:1. */}
      <Flex
        direction="column"
        alignSelf="stretch"
        minH={0}
        pl={{ base: 0, md: 2 }}
        mt={{ base: 4, md: 0 }}
      >
        <Text
          mt={0}
          fontFamily={theme.fonts.heading}
          textStyle="condensed"
          fontSize="2.7rem"
          color={theme.colors.brand.Pink}
          userSelect="text"
          whiteSpace={{ base: "normal", md: "nowrap" }}
          textTransform="uppercase"
          flexShrink={0}
          lineHeight={1.1}
        >
          {metadata.name ?? "Unnamed NFT"}
        </Text>

        <Text
          fontFamily={theme.fonts.body}
          fontSize="md"
          color={theme.colors.brand.DarkPurple}
          mt={1}
          mb={4}
          userSelect="text"
          whiteSpace="pre-wrap"
          flexShrink={0}
        >
          {metadata.description ?? "No description available."}
        </Text>

        {/* Traits grow to fill all remaining space, scrolling if needed */}
        <Box flex="1" overflowY="auto" minH={0}>
          <Traits metadata={metadata} />
        </Box>

        <Button
          as="a"
          href={shareUrl}
          target="_blank"
          rel="noopener noreferrer"
          mt={3}
          w="full"
          bg="transparent"
          color={theme.colors.brand.Purple}
          border="2px solid"
          borderColor={theme.colors.brand.Purple}
          borderRadius={0}
          textStyle="narrow"
          fontSize="xl"
          textTransform="uppercase"
          leftIcon={<Icon as={SiX} boxSize={4} color={theme.colors.brand.Purple} />}
          _hover={{ bg: theme.colors.brand.Purple, color: "white", "& svg": { color: "white" } }}
          _active={{ bg: theme.colors.brand.DarkPurple, borderColor: theme.colors.brand.DarkPurple, color: "white" }}
          flexShrink={0}
        >
          SHARE ON X
        </Button>
      </Flex>
    </Box>
  );
}
