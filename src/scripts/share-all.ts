import { NS } from '@ns';

export async function main(ns: NS): Promise<void> {
  while (true) {
    const server = ns.getServer();
    const threads = Math.floor(Math.max(server.maxRam - server.ramUsed - 64, 0) / 4);
    if (threads > 0) {
      ns.run('/scripts/primitives/share.js', threads);
    }
    await ns.sleep(10000 + 100);
  }
}
