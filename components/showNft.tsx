import { JsonMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { PublicKey } from "@metaplex-foundation/umi";
import { Box, Text, Divider, SimpleGrid, VStack, Accordion, AccordionItem, AccordionButton, AccordionPanel, AccordionIcon } from "@chakra-ui/react";
import React from "react";
import DOMPurify from "dompurify";

// Sanitize text content before rendering
const SafeText = ({ content }: { content: string }) => {
  return <span dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }} />;
};

interface TraitProps {
  heading: string;
  description: string;
}

interface TraitsProps {
  metadata: JsonMetadata;
}

const Trait = ({ heading, description }: TraitProps) => {
  if (!heading || !description) {
    return null;
  }
  return (
    <Box
      backgroundColor="gray.200"
      borderRadius="md"
      width="120px"
      minHeight="50px"
      p={2} // Add padding for better spacing
    >
      <VStack>
        <Text fontSize="sm"><SafeText content={heading} /></Text>
        <Text fontSize="sm" marginTop="-2" fontWeight="semibold">
          <SafeText content={description} />
        </Text>
      </VStack>
    </Box>
  );
};

const Traits = ({ metadata }: TraitsProps) => {
  if (!metadata?.attributes) {
    return null;
  }

  // Filter attributes with valid trait_type and value
  const traits = metadata.attributes.filter(
    (a) => a.trait_type && a.value
  );

  const traitList = traits.map((t) => (
    <Trait
      key={t.trait_type ?? ""}
      heading={t.trait_type ?? ""}
      description={t.value ?? ""}
    />
  ));

  return (
    <>
      <Divider marginTop="15px" />
      <SimpleGrid marginTop="15px" columns={3} spacing={5}>
        {traitList}
      </SimpleGrid>
    </>
  );
};

// Check if the image URL is from a trusted source
const isTrustedUrl = (url: string): boolean => {
  const trustedDomains = ["trusted.com", "another-trusted-source.com"];
  try {
    const { hostname } = new URL(url);
    return trustedDomains.includes(hostname);
  } catch (e) {
    return false;
  }
};

const Card = ({ metadata }: { metadata: JsonMetadata | undefined }) => {
  if (!metadata) {
    return null;
  }

  const image = metadata.animation_url ?? metadata.image;

  if (!image || !isTrustedUrl(image)) {
    return null; // If the URL is not trusted, don't render the image
  }

  return (
    <Box position="relative" width="full" overflow="hidden">
      <Box
        key={image}
        height="sm"
        position="relative"
        backgroundPosition="center"
        backgroundRepeat="no-repeat"
        backgroundSize="cover"
        backgroundImage={`url(${image})`}
      />
      <Text fontWeight="semibold" marginTop="15px">
        <SafeText content={metadata.name ?? ""} />
      </Text>
      <Text>
        <SafeText content={metadata.description ?? ""} />
      </Text>
      <Traits metadata={metadata} />
    </Box>
  );
};

type Props = {
  nfts: { mint: PublicKey; offChainMetadata: JsonMetadata | undefined }[] | undefined;
};

export const ShowNft = ({ nfts }: Props) => {
  if (!nfts) {
    return null;
  }

  const cards = nfts.map((nft) => (
    <AccordionItem key={nft.mint + "Accordion"}>
      <h2>
        <AccordionButton>
          <Box as="span" flex="1" textAlign="left">
            <SafeText content={nft.offChainMetadata?.name ?? "Unknown NFT"} />
          </Box>
          <AccordionIcon />
        </AccordionButton>
      </h2>
      <AccordionPanel pb={4}>
        <Card metadata={nft.offChainMetadata} key={nft.mint} />
      </AccordionPanel>
    </AccordionItem>
  ));

  return (
    <Accordion defaultIndex={[0]} allowMultiple>
      {cards}
    </Accordion>
  );
};