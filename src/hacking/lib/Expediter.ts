import { getServers } from '@/lib/utils';
import { NS } from '@ns';

const HOME_RESERVED = 32;

type Block = { hostname: string; max: number; ram: number; reserved: number };
export class Expediter {
  private static USE_HACKNET = false;
  largest: number;
  smallest: number;
  total: number;
  servers: Map<string, Block>;
  blocks: Block[];

  constructor(private ns: NS) {
    this.largest = 0;
    this.smallest = Infinity;
    this.total = 0;
    this.servers = new Map<string, Block>();
    this.blocks = getServers(ns)
      .map(ns.getServer)
      .filter((s) => s.hasAdminRights && (Expediter.USE_HACKNET || !s.hostname.startsWith('hacknet')))
      .map((s) => {
        const so = ns.getServer(s.hostname);
        const block = {
          hostname: so.hostname,
          max: so.maxRam,
          ram: so.maxRam - so.ramUsed,
          reserved: so.hostname === 'home' ? HOME_RESERVED : 0,
        };
        const avail = block.ram - block.reserved;
        this.largest = Math.max(this.largest, avail);
        this.smallest = Math.min(this.smallest, avail);
        this.total += avail;
        this.servers.set(block.hostname, block);
        return block;
      })
      .sort(Expediter.blockSort);
  }

  static from(other: Expediter): Expediter {
    const clone = Object.create(Expediter.prototype) as Expediter;
    clone.ns = other.ns;
    clone.largest = other.largest;
    clone.smallest = other.smallest;
    clone.blocks = structuredClone(other.blocks);

    return clone;
  }

  private static blockSort(a: Block, b: Block): number {
    if (a.hostname === 'home') return 1;
    if (b.hostname === 'home') return -1;

    if (a.ram - a.reserved > b.ram - b.reserved) return 1;
    if (a.ram - a.reserved < b.ram - b.reserved) return -1;

    return 0;
  }

  copy(): Expediter {
    return Expediter.from(this);
  }

  update(): void {
    let updated = false;
    getServers(this.ns)
      .map(this.ns.getServer)
      .filter((s) => s.hasAdminRights && (Expediter.USE_HACKNET || !s.hostname.startsWith('hacknet')))
      .forEach((s) => {
        if (!this.servers.has(s.hostname)) {
          // If the block doesn't exist add it
          updated = true;
          const so = this.ns.getServer(s.hostname);
          const block = {
            hostname: so.hostname,
            max: so.maxRam,
            ram: so.maxRam - so.ramUsed,
            reserved: so.hostname === 'home' ? HOME_RESERVED : 0,
          };
          const avail = block.ram - block.reserved;
          this.largest = Math.max(this.largest, avail);
          this.smallest = Math.min(this.smallest, avail);
          this.total += avail;
          this.servers.set(block.hostname, block);
          this.blocks.push(block);
        } else {
          // If it does check to make sure the max ram hasn't changed
          const block = this.servers.get(s.hostname) as Block;
          const so = this.ns.getServer(s.hostname);
          if (block.max !== so.maxRam) {
            updated = true;

            let avail = block.ram - block.reserved;
            this.total -= avail;
            block.max = so.maxRam;
            block.ram = so.maxRam - so.ramUsed;
            avail = block.ram - block.reserved;
            this.largest = Math.max(this.largest, avail);
            this.smallest = Math.min(this.smallest, avail);
            this.total += avail;
          }
        }
      });
    if (updated) this.blocks.sort(Expediter.blockSort);
  }

  reserve(amount: number): string | undefined {
    const block = this.blocks.find((b) => b.ram - b.reserved >= amount);
    if (block === undefined) return undefined;

    const updateLargest = block.ram - block.reserved === this.largest;
    const updateSmallest = block.ram - block.reserved === this.smallest;

    block.reserved += amount;

    if (updateLargest) this.largest = this.blocks.reduce((largest, b) => Math.max(largest, b.ram - b.reserved), 0);
    if (updateSmallest) this.smallest = this.blocks.reduce((smallest, b) => Math.min(smallest, b.ram - b.reserved), 0);
    this.total -= amount;

    return block.hostname;
  }

  free(amount: number, hostname: string): boolean {
    const block = this.blocks.find((b) => b.hostname === hostname);
    if (block === undefined || block.reserved < amount) return false;

    block.reserved -= amount;
    this.largest = Math.max(this.largest, block.ram - block.reserved);
    this.smallest = Math.min(this.smallest, block.ram - block.reserved);
    this.total += amount;
    return true;
  }
}
