/* eslint-disable prettier/prettier */
import { getServers } from '@/lib/utils';
import { NS } from '@ns';

export async function hackServer(ns: NS, server: string): Promise<boolean> {
  try { ns.brutessh(server); } catch { /* nothing */ }
  try { ns.ftpcrack(server); } catch { /* nothing */ }
  try { ns.httpworm(server); } catch { /* nothing */ }
  try { ns.sqlinject(server); } catch { /* nothing */ }
  try { ns.relaysmtp(server); } catch { /* nothing */ }
  try {
    return ns.nuke(server);
  } catch { /* nothing */ }
  return false;
}

export async function main(ns: NS): Promise<void> {
  let rooted = 0;
  for (const s of getServers(ns)) {
    if (await hackServer(ns, s)) rooted++;
  }
  ns.tprint(`Rooted ${rooted} servers.`);
}