import { NS } from '@ns';
import { Block } from '@/lib/utils';
import { Job } from '@/lib/Job';

export class RamNet {
  #blocks: Block[] = [];
  #minBlockSize = Infinity;
  #maxBlockSize = 0;
  #totalRam = 0;
  #maxRam = 0;
  #prepThreads = 0;
  #index = new Map();

  constructor(ns: NS, servers: string[]) {
    for (const server of servers) {
      if (ns.hasRootAccess(server)) {
        const maxRam = ns.getServerMaxRam(server);
        const ram = maxRam - ns.getServerUsedRam(server);

        if (ram >= 1.6) {
          const block = { server, ram };
          this.#blocks.push(block);
          if (ram < this.#minBlockSize) {
            this.#minBlockSize = ram;
          }
          if (ram > this.#maxBlockSize) {
            this.#maxBlockSize = ram;
          }
          this.#totalRam += ram;
          this.#maxRam += maxRam;
          this.#prepThreads += Math.floor(ram / 1.75);
        }
      }
    }
    this.#sort();
    this.#blocks.forEach((block, index) => this.#index.set(block.server, index));
  }

  #sort(): void {
    this.#blocks.sort((x, y) => {
      // Make the home server last so it can actually be used.
      if (x.server === 'home') {
        return 1;
      } else if (y.server === 'home') {
        return -1;
      }

      return x.ram - y.ram;
    });
  }

  getBlock(server: string): Block {
    if (this.#index.has(server)) {
      return this.#blocks[this.#index.get(server)];
    } else {
      throw new Error(`Server ${server} not found in RamNet.`);
    }
  }

  totalRam(): number {
    return this.#totalRam;
  }

  maxRam(): number {
    return this.#maxRam;
  }

  maxBlockSize(): number {
    return this.#maxBlockSize;
  }

  prepThreads(): number {
    return this.#prepThreads;
  }

  assign(job: Job): boolean {
    const block = this.#blocks.find((block) => block.ram >= job.cost);
    if (block) {
      job.server = block.server;
      block.ram -= job.cost;
      this.#totalRam -= job.cost;
      return true;
    }
    return false;
  }

  finish(job: Job): void {
    const block = this.getBlock(job.server);
    block.ram += job.cost;
    this.#totalRam += job.cost;
  }

  cloneBlocks(): Block[] {
    return this.#blocks.map((block) => ({ ...block }));
  }

  printBlocks(ns: NS): void {
    for (const block of this.#blocks) {
      ns.print(block);
    }
  }
}
