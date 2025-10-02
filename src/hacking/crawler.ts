/* eslint-disable prettier/prettier */
import { getServers } from '@/lib/utils';
import { NS } from '@ns';

export async function hackServer(ns: NS, s: string): Promise<boolean> {
  try { ns.brutessh(s) } catch { /* nothing */ }
  try { ns.ftpcrack(s) } catch { /* nothing */ }
  try { ns.httpworm(s) } catch { /* nothing */ }
  try { ns.sqlinject(s) } catch { /* nothing */ }
  try { ns.relaysmtp(s) } catch { /* nothing */ }
  try { return ns.nuke(s); } catch { return false }
}

export function copyWorkers(ns: NS, servers: string[]) {
  const scripts = ns.ls('home', '/hacking/workers').concat(
    ns.ls('home', '/scripts/workers')
  )
  servers.forEach((s) => ns.scp(scripts, s));
}

export async function main(ns: NS): Promise<void> {
  const servers = getServers(ns);
  let rooted = 0;
  for (const s of servers) {
    if (await hackServer(ns, s)) rooted++;
  }

  copyWorkers(ns, servers);

  ns.tprint(`Rooted ${rooted} servers.`);
}