import { NS } from '@ns';

const HOME_RESERVED = 32;

type Block = { hostname: string; max: number; ram: number; reserved: number };
export class Expediter {
  largest: number;
  smallest: number;
  total: number;
  blocks: Block[];

  constructor(private ns: NS) {
    this.largest = 0;
    this.smallest = Infinity;
    this.total = 0;
    this.blocks = getServers(ns)
      .filter((s) => ns.getServer(s).hasAdminRights)
      .map((s) => {
        const so = ns.getServer(s);
        const hostname = so.hostname;
        const max = so.maxRam;
        const ram = max - so.ramUsed;
        const reserved = so.hostname === 'home' ? HOME_RESERVED : 0;
        this.largest = Math.max(this.largest, ram - reserved);
        this.smallest = Math.min(this.smallest, ram - reserved);
        this.total += ram - reserved;
        return { hostname, max, ram, reserved };
      })
      .sort((a, b) => {
        if (a.hostname === 'home') return 1;
        if (b.hostname === 'home') return -1;

        if (a.ram - a.reserved > b.ram - b.reserved) return 1;
        if (a.ram - a.reserved < b.ram - b.reserved) return -1;

        return 0;
      });
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

function getServers(ns: NS): string[] {
  const z: (t: string) => string[] = (t) => [
    t,
    ...ns
      .scan(t)
      .slice(t !== 'home' ? 1 : 0)
      .flatMap(z),
  ];
  return z('home');
}
