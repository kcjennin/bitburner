import { getCacheData, ServersCache } from '@/lib/Cache';
import { NS } from '@ns';

export interface ServerInfo {
  name: string;
  ram: number;
  reserved: number;
  max: number;
}

export class ServerPool {
  private static USE_HACKNET = false;
  private servers: ServerInfo[];

  constructor(private readonly ns: NS) {
    this.servers = getCacheData(ns, ServersCache)
      .filter(
        (s) =>
          s.hasAdminRights &&
          (s.hostname === 'home' ? s.maxRam - 32 : s.maxRam) > 1.6 &&
          (ServerPool.USE_HACKNET || !s.hostname.startsWith('hacknet')),
      )
      .map((so) => {
        const s = ns.getServer(so.hostname);
        const max = s.maxRam;
        const ram = s.maxRam - s.ramUsed;
        const reserved = s.hostname === 'home' ? 32 : 0;
        return { name: s.hostname, ram, reserved, max };
      })
      .sort((a, b) => {
        if (a.name === 'home') return 1;
        else if (b.name === 'home') return -1;
        else return a.ram - a.reserved - (b.ram - b.reserved);
      });
  }

  reserve(ram: number): string | undefined {
    const si = this.servers.find((s) => s.ram - s.reserved >= ram);
    if (si === undefined) return si;

    si.reserved += ram;
    return si.name;
  }

  free(name: string, ram: number): void {
    const si = this.servers.find((s) => s.name === name);
    if (si === undefined || si.reserved < ram) throw `Invalid free: ${name} ${this.ns.formatRam(ram)}`;
    si.reserved -= ram;
  }

  maxRam(): number {
    const minVal = this.servers.reduce((min, s) => Math.min(min, s.ram - s.reserved), Infinity);
    if (minVal === Infinity) return 0;
    return minVal;
  }
}
