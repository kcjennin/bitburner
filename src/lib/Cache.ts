import { BitNodeMultipliers, NS, Player, Server } from '@ns';
import { getServers } from './utils';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface CacheKey<T> {
  filename: string;
  cutoffType: CutoffType;
}

interface CacheValue<T> {
  time: number;
  data: T;
}

type CutoffType = 'aug' | 'node';

export const BitNodeMultiplersCache: CacheKey<BitNodeMultipliers> = {
  filename: '/data/bitnodemultipliers.json.txt',
  cutoffType: 'node',
};
export const ServersCache: CacheKey<Server[]> = { filename: '/data/servers.json.txt', cutoffType: 'aug' };
export const PlayerCache: CacheKey<Player> = { filename: '/data/player.json.txt', cutoffType: 'aug' };

export function setCacheData<T>(ns: NS, key: CacheKey<T>, data: T): void {
  ns.write(key.filename, JSON.stringify({ time: Date.now(), data }, undefined, 2), 'w');
}

export function getCacheData<T>(ns: NS, key: CacheKey<T>): T {
  const { lastAugReset, lastNodeReset } = ns.getResetInfo();
  const fileData = ns.read(key.filename);
  if (fileData === '') throw `Empty cache: ${key}`;

  const { time, data } = JSON.parse(fileData) as CacheValue<T>;
  const cutoff = key.cutoffType === 'aug' ? lastAugReset : lastNodeReset;

  if (time < cutoff) throw `Stale data: ${typeof data}`;
  return data;
}

export async function main(ns: NS): Promise<void> {
  setCacheData(ns, BitNodeMultiplersCache, ns.getBitNodeMultipliers());
  setCacheData(ns, ServersCache, getServers(ns).map(ns.getServer));
  setCacheData(ns, PlayerCache, ns.getPlayer());
}
