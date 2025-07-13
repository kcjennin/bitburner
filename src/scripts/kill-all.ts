import { getServers } from '@/lib/utils';
import { NS } from '@ns';

export async function main(ns: NS): Promise<void> {
  const args = ns.flags([['x', '']]);
  getServers(ns)
    .filter((s) => s !== args.x)
    .forEach((s) => ns.killall(s, true));
}
