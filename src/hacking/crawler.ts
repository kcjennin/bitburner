/* eslint-disable prettier/prettier */
import { getCacheData, ServersCache, setCacheData } from '@/lib/Cache';
import { NS, Server } from '@ns';

export async function hackServer(ns: NS, s: Server): Promise<boolean> {
  let open = 0;
  try { if (ns.brutessh(s.hostname)) s.sshPortOpen = true; open++; } catch { /* nothing */ }
  try { if (ns.ftpcrack(s.hostname)) s.ftpPortOpen = true; open++; } catch { /* nothing */ }
  try { if (ns.httpworm(s.hostname)) s.httpPortOpen = true; open++; } catch { /* nothing */ }
  try { if (ns.sqlinject(s.hostname)) s.sqlPortOpen = true; open++; } catch { /* nothing */ }
  try { if (ns.relaysmtp(s.hostname)) s.smtpPortOpen = true; open++ } catch { /* nothing */ }
  try {
    s.openPortCount = open;

    const nukeVal = ns.nuke(s.hostname);
    s.hasAdminRights = nukeVal;
    return nukeVal;
  } catch { /* nothing */ }
  return false;
}

export async function main(ns: NS): Promise<void> {
  const servers = getCacheData(ns, ServersCache);
  let rooted = 0;
  for (const s of servers) {
    if (await hackServer(ns, s)) rooted++;
  }
  setCacheData(ns, ServersCache, servers);

  const scripts = ns.ls('home', '/hacking/workers').concat(
    ns.ls('home', '/scripts/workers')
  )
  servers.forEach((s) => ns.scp(scripts, s.hostname));

  ns.tprint(`Rooted ${rooted} servers.`);
}