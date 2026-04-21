import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Snapshot } from './types';

export async function loadSnapshot(): Promise<Snapshot> {
  const file = path.join(process.cwd(), 'public', 'data', 'snapshot.json');
  const raw = await fs.readFile(file, 'utf-8');
  return JSON.parse(raw) as Snapshot;
}

export type {
  Audience,
  AudienceSide,
  Reel,
  Snapshot,
  TikTokVideo,
} from './types';
export { formatNumber, formatDate } from './types';
