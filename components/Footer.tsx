// components/Footer.tsx
import React from 'react'
import { Box, Flex, Text, Link, Icon } from '@chakra-ui/react'
import { SiX, SiDiscord } from 'react-icons/si'

export function Footer() {
  return (
    <Box
      as="footer"
      width="100%"
      py={2}
      px={{ base: 4, md: 8 }}
      // no extra margin/padding to “push” content—just sits at bottom of its container
    >
      <Flex align="center" justify="space-between">
        {/* left: legal text */}
        <Text fontSize="0.75rem" color="gray.DarkPurple">
          © {new Date().getFullYear()} LFGNFT. All rights reserved.
        </Text>

        {/* right: social icons */}
        <Flex align="center" gap={4}>
          <Link href="https://x.com/LetsFlamingoNFT" isExternal aria-label="X (formerly Twitter)">
            <Icon as={SiX} boxSize={5} _hover={{ color: 'brand.Purple' }} />
          </Link>
          <Link href="https://discord.gg/Bek9PJgYz8" isExternal aria-label="Discord">
            <Icon as={SiDiscord} boxSize={5} _hover={{ color: 'brand.Pink' }} />
          </Link>
        </Flex>
      </Flex>
    </Box>
  )
}