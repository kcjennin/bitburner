import { getCacheData, ServersCache } from '@/lib/Cache';
import { NS } from '@ns';

export async function main(ns: NS): Promise<void> {
  const args = ns.flags([['x', '']]);
  getCacheData(ns, ServersCache)
    .filter((s) => s.hostname !== args.x)
    .forEach((s) => ns.killall(s.hostname, true));
}
