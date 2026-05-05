import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { History, Snapshot } from './types';

export async function loadSnapshot(): Promise<Snapshot> {
  const file = path.join(process.cwd(), 'public', 'data', 'snapshot.json');
  const raw = await fs.readFile(file, 'utf-8');
  return JSON.parse(raw) as Snapshot;
}

export async function loadHistory(): Promise<History> {
  const file = path.join(process.cwd(), 'public', 'data', 'history.json');
  try {
    const raw = await fs.readFile(file, 'utf-8');
    return JSON.parse(raw) as History;
  } catch {
    return { entries: [] };
  }
}

export type {
  Audience,
  AudienceSide,
  History,
  HistoryEntry,
  MailchimpLocation,
  Reel,
  Snapshot,
  TikTokVideo,
} from './types';
export { formatNumber, formatDate } from './types';
