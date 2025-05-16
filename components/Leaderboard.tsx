// components/Leaderboard.tsx
import React, { useEffect, useState, useRef } from 'react';
import {
  Box,
  Spinner,
  Text,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Center,
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
};

export default function Leaderboard({
  onTopStatus,
  withBorders = false,
  height,
  columnWidths = {},
}: Props) {
  const [entries, setEntries]     = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [mounted, setMounted]     = useState(false);
  const containerRef              = useRef<HTMLDivElement>(null);
  const { publicKey }             = useWallet();
  const myWallet                  = publicKey?.toString();

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    if (!containerRef.current || hasLoaded) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setLoading(true);
          obs.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [hasLoaded]);

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

  useEffect(() => {
    if (hasLoaded && onTopStatus) {
      onTopStatus(entries.some(e => e.wallet_address === myWallet));
    }
  }, [hasLoaded, entries, myWallet, onTopStatus]);

  const rows = Array.from({ length: 10 }).map((_, i) => {
    const e    = entries[i];
    const isMe = mounted && !!e && e.wallet_address === myWallet;
    return {
      key:      e?.wallet_address ?? `empty-${i}`,
      isMe,
      position: i + 1,
      user:     e?.display_name?.trim() || '–',
      score:    e?.score ?? '–',
      wallet:   e?.wallet_address ?? '–',
    };
  });

  const bg = useColorModeValue('white', 'gray.700');

  return (
    <Box
      ref={containerRef}
      bg={bg}
      p={4}
      borderRadius="md"
      boxShadow="sm"
      display="inline-block"    // shrink‐wrap to content
      w="max-content"           // width == sum of column widths
      h={height}
      minH="140px"
      mx="auto"
    >
      {error && (
        <Text color="red.500" textAlign="center">
          {error}
        </Text>
      )}

      {!hasLoaded && !error && (
        <Center h="100%">
          <Spinner size="lg" />
        </Center>
      )}

      {hasLoaded && !error && (
        <Table
          variant={withBorders ? 'simple' : 'unstyled'}
          size="sm"
          w="max-content"
          sx={{
            tableLayout:   'fixed',
            borderCollapse:'separate',
            borderSpacing: '3px',
          }}
        >
          <Thead>
            <Tr>
              <Th
                textStyle="normal"
                fontWeight="normal"
                textAlign="center"
                width={columnWidths.position ?? '51px'}
              >
                #
              </Th>
              <Th
                textStyle="normal"
                fontWeight="normal"
                textAlign="center"
                width={columnWidths.user}
              >
                User
              </Th>
              <Th
                textStyle="normal"
                fontWeight="normal"
                textAlign="center"
                width={columnWidths.score}
              >
                Score
              </Th>
              <Th
                textStyle="normal"
                fontWeight="normal"
                textAlign="center"
                width={columnWidths.wallet}
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
                  verticalAlign="middle"
                  width={columnWidths.position ?? '51px'}
                  bg={isMe ? 'brand.Purple' : 'brand.Lavender'}
                  color={isMe ? 'white' : 'brand.DarkPurple'}
                  px={4}
                  py={2}
                  whiteSpace="nowrap"
                >
                  {position}
                </Td>
                <Td
                  textStyle="ranking"
                  textAlign="center"
                  verticalAlign="middle"
                  width={columnWidths.user}
                  bg={isMe ? 'brand.Purple' : 'brand.Lavender'}
                  color={isMe ? 'white' : 'brand.DarkPurple'}
                  px={4}
                  py={2}
                  whiteSpace="nowrap"
                >
                  {user}
                </Td>
                <Td
                  textStyle="ranking"
                  textAlign="center"
                  verticalAlign="middle"
                  width={columnWidths.score}
                  bg={isMe ? 'brand.Purple' : 'brand.Lavender'}
                  color={isMe ? 'white' : 'brand.DarkPurple'}
                  px={4}
                  py={2}
                  whiteSpace="nowrap"
                >
                  {score}
                </Td>
                <Td
                  textStyle="ranking"
                  textAlign="center"
                  verticalAlign="middle"
                  width={columnWidths.wallet}
                  bg={isMe ? 'brand.Purple' : 'brand.Lavender'}
                  color={isMe ? 'white' : 'brand.DarkPurple'}
                  px={4}
                  py={2}
                  opacity={isMe ? 1 : 0.7}
                  whiteSpace="nowrap"
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
