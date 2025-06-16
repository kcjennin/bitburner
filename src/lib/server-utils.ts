// lib/server-utils.ts
import { NS } from '@ns';

export function getAllServers(ns: NS): string[] {
  const servers = ['home'];
  let idx = 0;
  while (idx < servers.length) {
    for (const newServer of ns.scan(servers[idx])) {
      if (!servers.includes(newServer)) {
        servers.push(newServer);
      }
    }
    idx += 1;
  }
  return servers;
}
