#!/usr/bin/env ts-node
/**
 * utils/admin.ts
 *
 * CLI entrypoint for:
 *   • clear-leaderboard
 *   • remove-entry <wallet_address>
 *   • update-allowlist
 *
 * Reads ADMIN_PASSWORD from .env, then invokes the above utilities.
 */

import { Command } from 'commander';
import 'dotenv/config';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!ADMIN_PASSWORD) {
  console.error('❌ ADMIN_PASSWORD not set in .env');
  process.exit(1);
}

// pull in your utility functions
import { clearLeaderboard } from './leaderboard/clearLeaderboard.ts';
import { removeEntry }      from './leaderboard/removeEntry.ts';

const cli = new Command();

cli
  .name('admin')
  .description('🔧 Leaderboard CLI')
  .version('1.0.0');

// — clear-leaderboard —
cli
  .command('clear-leaderboard')
  .description('🗑 Delete ALL rows in the leaderboard')
  .action(async () => {
    console.log('🔒 Verifying ADMIN_PASSWORD');
    try {
      const deleted = await clearLeaderboard();
      console.log(`✅ Cleared ${deleted} entr${deleted === 1 ? 'y' : 'ies'}.`);
      process.exit(0);
    } catch (err: any) {
      console.error('❌ Failed to clear leaderboard:', err.message || err);
      process.exit(1);
    }
  });

// — remove-entry —
cli
  .command('remove-entry <wallet>')
  .description('🗑 Remove one leaderboard entry by wallet')
  .action(async (wallet: string) => {
    console.log('🔒 Verifying ADMIN_PASSWORD');
    try {
      const removed = await removeEntry(wallet);
      console.log(`✅ Removed ${removed} entr${removed === 1 ? 'y' : 'ies'}.`);
      process.exit(0);
    } catch (err: any) {
      console.error('❌ Failed to remove entry:', err.message || err);
      process.exit(1);
    }
  });

cli.parse(process.argv);
