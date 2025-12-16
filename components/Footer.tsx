// components/Footer.tsx
import React from 'react'
import { Box, Flex, Text, Link, Icon } from '@chakra-ui/react'
import { SiX, SiDiscord, SiTelegram } from 'react-icons/si'
import { MdOutlineStorefront, MdInsights, MdRadar } from 'react-icons/md'

const MAGIC_EDEN_URL  = 'https://magiceden.io/marketplace/letsflamingonft'          // ← put your collection URL here
const TENSOR_URL      = 'https://www.tensor.trade/trade/letsflamingonft'      // ← or direct collection link
const DAPPRADAR_URL   = 'https://dappradar.com/dapp/let-s-flamingo'         // ← or your app’s page

export function Footer() {
  return (
    <Box
      as="footer"
      width="100%"
      py={3}
      px={{ base: 4, md: 8 }}
      bg="brand.Pink"
      color="brand.White"
    >
      <Flex align="center" justify="space-between">
        {/* left: legal text */}
        <Text fontSize="0.75rem">
          {new Date().getFullYear()} ©LFGNFT
        </Text>

        {/* right: social + marketplaces */}
        <Flex align="center" gap={4}>
          {/* X */}
          <Link
            href="https://x.com/LetsFlamingoNFT"
            isExternal
            aria-label="X (formerly Twitter)"
            display="inline-flex"
            alignItems="center"
            justifyContent="center"
            lineHeight="1"
          >
            <Icon as={SiX} boxSize={5} _hover={{ color: 'brand.DarkPurple' }} />
          </Link>

          {/* Discord */}
          <Link
            href="https://discord.gg/Bek9PJgYz8"
            isExternal
            aria-label="Discord"
            display="inline-flex"
            alignItems="center"
            justifyContent="center"
            lineHeight="1"
          >
            <Icon as={SiDiscord} boxSize={5} _hover={{ color: 'brand.Purple' }} />
          </Link>

          {/* Telegram */}
          <Link
            href="https://t.me/letsflamingo"
            isExternal
            aria-label="Telegram"
            display="inline-flex"
            alignItems="center"
            justifyContent="center"
            lineHeight="1"
          >
            <Icon as={SiTelegram} boxSize={5} _hover={{ color: 'brand.Purple' }} />
          </Link>

          {/* Magic Eden */}
          <Link
            href={MAGIC_EDEN_URL}
            isExternal
            aria-label="Magic Eden"
            display="inline-flex"
            alignItems="center"
            justifyContent="center"
            lineHeight="1"
          >
            <Icon as={MdOutlineStorefront} boxSize={5} _hover={{ color: 'brand.DarkPurple' }} />
          </Link>

          {/* Tensor */}
          <Link
            href={TENSOR_URL}
            isExternal
            aria-label="Tensor"
            display="inline-flex"
            alignItems="center"
            justifyContent="center"
            lineHeight="1"
          >
            <Icon as={MdInsights} boxSize={5} _hover={{ color: 'brand.DarkPurple' }} />
          </Link>

          {/* DappRadar */}
          <Link
            href={DAPPRADAR_URL}
            isExternal
            aria-label="DappRadar"
            display="inline-flex"
            alignItems="center"
            justifyContent="center"
            lineHeight="1"
          >
            <Icon as={MdRadar} boxSize={5} _hover={{ color: 'brand.DarkPurple' }} />
          </Link>
        </Flex>
      </Flex>
    </Box>
  )
}
