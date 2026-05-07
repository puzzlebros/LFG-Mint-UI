// components/Leaderboard.tsx
import React, { useEffect } from 'react';
import {
  Box,
  Icon,
  Text,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Skeleton,
  useBreakpointValue,
  useColorModeValue
} from '@chakra-ui/react';
import { FaCrown } from 'react-icons/fa';
import { useWallet } from '@solana/wallet-adapter-react';
import { useLeaderboard } from '../components/LeaderboardContext';

function truncateWallet(addr: string, start = 5, end = 4): string {
  if (!addr || addr.length <= start + end + 3) return addr;
  return `${addr.slice(0, start)}...${addr.slice(-end)}`;
}

type ColumnWidths = {
  position?: string;
  user?: string;
  score?: string;
  wallet?: string;
};

type Props = {
  onTopStatus?: (inTop: boolean) => void;
  withBorders?: boolean;
  height?: string | number;
  columnWidths?: ColumnWidths;
  bgColor?: string;
};

export default function Leaderboard({
  onTopStatus,
  withBorders = false,
  height,
  columnWidths = {},
  bgColor,
}: Props) {
  const defaultBg = useColorModeValue('white', 'gray.700');

  // 1️⃣ Pull everything from context
  const {
    leaderboardEntries,
    topWallets,
    loading: ctxLoading,
    error: ctxError,
  } = useLeaderboard();

  const { publicKey } = useWallet();
  const myWallet = publicKey?.toString();

  // 2️⃣ Responsive TextAlign, explicitly typed
  const headerAlign = useBreakpointValue<'left' | 'center'>({
    base: 'left',
    md: 'left',
  });

  // 3️⃣ Report top-10 status upstream (real wallets only — no fakes)
  useEffect(() => {
    if (onTopStatus && myWallet) {
      onTopStatus(topWallets.includes(myWallet));
    }
  }, [onTopStatus, topWallets, myWallet]);

  // 4️⃣ Always render 10 rows; unfilled slots show "–"
  const rows = Array.from({ length: 10 }).map((_, i) => {
    const e = leaderboardEntries[i];
    return {
      key: e?.wallet_address ?? `empty-${i}`,
      isMe: !!e && e.wallet_address === myWallet,
      position: i + 1,
      user: e?.display_name?.trim() || '–',
      score: e?.score ?? '–',
      walletShort: e ? truncateWallet(e.wallet_address) : '–',
    };
  });

  const bg = bgColor ?? defaultBg;

  return (
    <Box
      bg={bg}
      pt={4}
      pb={4}
      pr={4}
      pl={8}
      borderRadius="md"
      boxShadow="none"
      display="inline-block"
      w="max-content"
      h={height}
      minH="140px"
      mx="auto"
      position="relative"
    >
      {/* Filled crown sits in the left padding, centered on first data row */}
      {!ctxLoading && !ctxError && leaderboardEntries[0] && (
        <Icon
          as={FaCrown}
          position="absolute"
          left="2px"
          top={{ base: '40px', md: '64px' }}
          transform="translateY(-50%)"
          color="#FFCE00"
          boxSize="22px"
        />
      )}
      {/* Error from context */}
      {ctxError && (
        <Text color="red.500" textAlign="center">
          {ctxError}
        </Text>
      )}

      {/* Skeleton while context is loading */}
      {ctxLoading && !ctxError && (
        <Table
          variant={withBorders ? 'simple' : 'unstyled'}
          size="sm"
          w="max-content"
          sx={{
            tableLayout: 'fixed',
            borderCollapse: 'separate',
            borderSpacing: '3px',
          }}
        >
          <Thead display={{ base: 'none', md: 'table-header-group' }}>
            <Tr>
              <Th width={columnWidths.position ?? '51px'} textAlign={headerAlign} textStyle="narrow">
                #
              </Th>
              <Th width={columnWidths.user} textAlign={headerAlign} textStyle="narrow">
                User
              </Th>
              <Th width={columnWidths.score} textAlign={headerAlign} textStyle="copy">
                Score
              </Th>
              <Th
                display={{ base: 'none', md: 'table-cell' }}
                width={columnWidths.wallet}
                textAlign={headerAlign}
                textStyle="narrow"
              >
                Wallet
              </Th>
            </Tr>
          </Thead>
          <Tbody>
            {rows.map((_, idx) => (
              <Tr key={`skeleton-${idx}`}>
                <Td width={columnWidths.position ?? '51px'} py={3}>
                  <Skeleton h="20px" />
                </Td>
                <Td width={columnWidths.user} py={3}>
                  <Skeleton h="20px" />
                </Td>
                <Td width={columnWidths.score} py={3}>
                  <Skeleton h="20px" />
                </Td>
                <Td
                  display={{ base: 'none', md: 'table-cell' }}
                  width={columnWidths.wallet}
                  py={3}
                >
                  <Skeleton h="20px" />
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      {/* Real table once context is done loading */}
      {!ctxLoading && !ctxError && (
        <Table
          variant="unstyled" 
          size="sm"
          w="max-content"
          sx={{
            tableLayout: 'fixed',
            borderCollapse: 'separate',
            borderSpacing: '2px',
          }}
        >
          <Thead display={{ base: 'none', md: 'table-header-group' }}>
            <Tr>
    <Th
      width={columnWidths.position ?? '51px'}
      textAlign="left"
      textStyle="copy"
      textColor={'brand.Purple'}
      fontFamily="body"
      fontSize="0.75rem"  // smaller
      px={1}              // align with TDs
      pt={0}
    >                #
              </Th>
              <Th width={columnWidths.user} textAlign={headerAlign} fontSize="0.7rem"      px={1}     textTransform="none"         // align with TDs
 textStyle="copy" fontFamily="body"      textColor={'brand.Purple'}
>
                User
              </Th>
              <Th width={columnWidths.score} textAlign={headerAlign} fontSize="0.7rem"      px={1}   textTransform="none"           // align with TDs
 textStyle="copy" fontFamily="body"      textColor={'brand.Purple'}
>
                Score
              </Th>
              <Th
                display={{ base: 'none', md: 'table-cell' }}
                width={columnWidths.wallet}
                textAlign={headerAlign}
                textStyle="copy"
                fontFamily="body"
                textTransform="none"
                      textColor={'brand.Purple'}
fontSize="0.7rem"
                      px={1}              // align with TDs

              >
                Wallet
              </Th>
            </Tr>
          </Thead>
          <Tbody>
            {rows.map(({ key, isMe, position, user, score, walletShort }) => {
              const isFirst = position === 1;
              const rowBg = isMe
                ? 'brand.Purple'
                : isFirst
                ? 'brand.Winner'
                : 'brand.Lavender';
              const rowColor = isMe ? 'white' : 'brand.DarkPurple';
              return (
              <Tr key={key}>
                <Td
                  textStyle="ranking"
                  fontWeight="black"
                  textAlign="center"
                  bg={rowBg}
                  color={rowColor}
                  width={columnWidths.position ?? '51px'}
                  px={4}
                  py={3}
                >
                  {position}
                </Td>
                <Td
                  textStyle="ranking"
                  textAlign="center"
                  bg={rowBg}
                  color={rowColor}
                  width={columnWidths.user}
                  px={4}
                  py={3}
                  fontWeight={isFirst ? 'bold' : 'normal'}
                  fontSize={isFirst ? '16px' : '16px'}
                >
                  {user}
                </Td>
                <Td
                  textStyle="ranking"
                  textAlign="center"
                  bg={rowBg}
                  color={rowColor}
                  width={columnWidths.score}
                  px={4}
                  py={3}
                  fontWeight={isFirst ? 'bold' : 'normal'}
                  fontSize={isFirst ? '16px' : '16px'}
                >
                  {score}
                </Td>
                <Td
                  display={{ base: 'none', md: 'table-cell' }}
                  textStyle="ranking"
                  textAlign="center"
                  bg={rowBg}
                  color={rowColor}
                  width={columnWidths.wallet}
                  px={4}
                  py={3}
                  opacity={isMe ? 1 : 0.7}
                >
                  {walletShort}
                </Td>
              </Tr>
              );
            })}
          </Tbody>
        </Table>
      )}
    </Box>
  );
}
