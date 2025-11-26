// components/Leaderboard.tsx
import React, { useEffect } from 'react';
import {
  Box,
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
import { useWallet } from '@solana/wallet-adapter-react';
import { useLeaderboard } from '../components/LeaderboardContext';

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
    top10Wallets,
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

  // 3️⃣ Report top-10 status upstream
  useEffect(() => {
    if (onTopStatus && myWallet) {
      onTopStatus(top10Wallets.includes(myWallet));
    }
  }, [onTopStatus, top10Wallets, myWallet]);

  // 4️⃣ Build exactly ten rows
  const rows = Array.from({ length: 10 }).map((_, i) => {
    const e = leaderboardEntries[i];
    const isMe = !!e && e.wallet_address === myWallet;
    return {
      key: e?.wallet_address ?? `empty-${i}`,
      isMe,
      position: i + 1,
      user: e?.display_name?.trim() || '–',
      score: e?.score ?? '–',
      wallet: e?.wallet_address ?? '–',
    };
  });

  const bg = bgColor ?? defaultBg;

  return (
    <Box
      bg={bg}
      p={4}
      borderRadius="md"
      boxShadow="none"
      display="inline-block"
      w="max-content"
      h={height}
      minH="140px"
      mx="auto"
    >
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
                <Td width={columnWidths.position ?? '51px'}>
                  <Skeleton h="20px" />
                </Td>
                <Td width={columnWidths.user}>
                  <Skeleton h="20px" />
                </Td>
                <Td width={columnWidths.score}>
                  <Skeleton h="20px" />
                </Td>
                <Td
                  display={{ base: 'none', md: 'table-cell' }}
                  width={columnWidths.wallet}
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
            {rows.map(({ key, isMe, position, user, score, wallet }) => (
              <Tr key={key}>
                <Td
                  textStyle="ranking"
                  fontWeight="black"
                  textAlign="center"
                  bg={isMe ? 'brand.Purple' : 'brand.Lavender'}
                  color={isMe ? 'white' : 'brand.DarkPurple'}
                  width={columnWidths.position ?? '51px'}
                  px={4}
                  py={2}
                >
                  {position}
                </Td>
                <Td
                  textStyle="ranking"
                  textAlign="center"
                  bg={isMe ? 'brand.Purple' : 'brand.Lavender'}
                  color={isMe ? 'white' : 'brand.DarkPurple'}
                  width={columnWidths.user}
                  px={4}
                  py={2}
                >
                  {user}
                </Td>
                <Td
                  textStyle="ranking"
                  textAlign="center"
                  bg={isMe ? 'brand.Purple' : 'brand.Lavender'}
                  color={isMe ? 'white' : 'brand.DarkPurple'}
                  width={columnWidths.score}
                  px={4}
                  py={2}
                >
                  {score}
                </Td>
                <Td
                  display={{ base: 'none', md: 'table-cell' }}
                  textStyle="ranking"
                  textAlign="center"
                  bg={isMe ? 'brand.Purple' : 'brand.Lavender'}
                  color={isMe ? 'white' : 'brand.DarkPurple'}
                  width={columnWidths.wallet}
                  px={4}
                  py={2}
                  opacity={isMe ? 1 : 0.7}
                >
                  {wallet}
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </Box>
  );
}
