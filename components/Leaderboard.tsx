import React, { useEffect, useState, useRef, CSSProperties } from 'react';
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
  useColorModeValue,
} from '@chakra-ui/react';
import axios from 'axios';
import { useWallet } from '@solana/wallet-adapter-react';
import type { LeaderboardEntry } from '@/types/leaderboard';

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
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { publicKey } = useWallet();
  const myWallet = publicKey?.toString();

  // Responsive header alignment: left on mobile, center on desktop
  const headerAlign = useBreakpointValue<CSSProperties['textAlign']>({ base: 'left', md: 'center' });

  // Lazy-load trigger
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setLoading(true);
          obs.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // Fetch data
  useEffect(() => {
    if (!loading || hasLoaded) return;
    axios
      .get<LeaderboardEntry[]>('/api/leaderboard')
      .then(res => {
        setEntries(res.data);
        setHasLoaded(true);
      })
      .catch(() => setError('Failed to load leaderboard.'))
      .finally(() => setLoading(false));
  }, [loading, hasLoaded]);

  // Report top‑10 status
  useEffect(() => {
    if (hasLoaded && onTopStatus) {
      onTopStatus(entries.some(e => e.wallet_address === myWallet));
    }
  }, [hasLoaded, entries, myWallet, onTopStatus]);

  // Prepare 10 rows
  const rows = Array.from({ length: 10 }).map((_, i) => {
    const e = entries[i];
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
      ref={containerRef}
      bg={bg}
      p={4}
      borderRadius="md"
      boxShadow="sm"
      display="inline-block"
      w="max-content"
      h={height}
      minH="140px"
      mx="auto"
    >
      {error && (
        <Text color="red.500" textAlign="center">
          {error}
        </Text>
      )}

      {/* loading skeleton */}
      {loading && !error && (
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
              <Th width={columnWidths.position ?? '51px'} textAlign={headerAlign} textStyle="narrow">#</Th>
              <Th width={columnWidths.user} textAlign={headerAlign} textStyle="narrow">User</Th>
              <Th width={columnWidths.score} textAlign={headerAlign} textStyle="narrow">Score</Th>
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
                <Td width={columnWidths.position ?? '51px'}><Skeleton h="20px" /></Td>
                <Td width={columnWidths.user}><Skeleton h="20px" /></Td>
                <Td width={columnWidths.score}><Skeleton h="20px" /></Td>
                <Td display={{ base: 'none', md: 'table-cell' }} width={columnWidths.wallet}><Skeleton h="20px" /></Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      {/* real table */}
      {hasLoaded && !error && (
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
              <Th width={columnWidths.position ?? '51px'} textAlign={headerAlign} textStyle="narrow">#</Th>
              <Th width={columnWidths.user} textAlign={headerAlign} textStyle="narrow">User</Th>
              <Th width={columnWidths.score} textAlign={headerAlign} textStyle="narrow">Score</Th>
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
