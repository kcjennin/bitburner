import { NS } from '@ns';
import { Expediter } from '@/hacking/lib/Expediter';

export class Target {
  private readonly COSTS = { h: 1.7, w1: 1.75, g: 1.75, w2: 1.75 };
  times: { h: number; w1: number; g: number; w2: number };
  threads: { h: number; w1: number; g: number; w2: number };
  ramRate: number;
  moneyRate: number;
  delay: number;
  end: number;
  batchMoney: number;
  maxBatches: number;
  actualMaxBatches: number;

  constructor(private ns: NS, public name: string, public spacer: number, public greed: number) {
    this.times = {
      h: 0,
      w1: 0,
      g: 0,
      w2: 0,
    };
    this.threads = {
      h: 0,
      w1: 0,
      g: 0,
      w2: 0,
    };
    this.ramRate = 0;
    this.moneyRate = 0;
    this.delay = 0;
    this.end = 0;
    this.batchMoney = 0;
    this.maxBatches = 0;
    this.actualMaxBatches = 0;
  }

  static best(
    ns: NS,
    ram: Expediter,
    name: string,
    slow = false,
    spacer = 20,
    min = 0.01,
    max = 0.9,
    step = 0.01,
  ): Target {
    if (slow) {
      min = 0.001;
      step = 0.001;
    }
    let best = new Target(ns, name, spacer, min).update(ram, 0);

    for (let greed = min + step; greed <= max; greed += step) {
      const current = new Target(ns, name, spacer, greed).update(ram, 0);
      if (current.weight() > best.weight()) best = current;
    }
    if (best.maxBatches === 0) throw 'Not enough RAM to batch his server.';
    return best;
  }

  update(ram: Expediter, scheduled: number, greed: number = this.greed): Target {
    const ns = this.ns;
    const so = ns.getServer(this.name);
    const po = ns.getPlayer();

    so.hackDifficulty = so.minDifficulty ?? 0;
    so.moneyAvailable = so.moneyMax ?? 0;

    this.times.h = Math.ceil(ns.formulas.hacking.hackTime(so, po));
    this.times.w1 = Math.ceil(ns.formulas.hacking.weakenTime(so, po));
    this.times.g = Math.ceil(ns.formulas.hacking.growTime(so, po));
    this.times.w2 = Math.ceil(ns.formulas.hacking.weakenTime(so, po));

    const hPercent = ns.formulas.hacking.hackPercent(so, po);
    this.threads.h = Math.ceil(greed / hPercent);
    this.batchMoney = Math.floor(so.moneyAvailable * hPercent) * this.threads.h;

    so.moneyAvailable -= this.batchMoney;
    so.hackDifficulty += this.threads.h * 0.002;

    this.threads.w1 = Math.ceil((so.hackDifficulty - (so.minDifficulty ?? 0)) / 0.05);
    so.hackDifficulty = so.minDifficulty ?? 0;

    // over approximate by 5%, hopefully reduces desyncs
    this.threads.g = Math.ceil(ns.formulas.hacking.growThreads(so, po, so.moneyMax ?? 0) * 1.05);
    so.moneyAvailable = so.moneyMax ?? 0;
    so.hackDifficulty += this.threads.g * 0.004;

    this.threads.w2 = Math.ceil((so.hackDifficulty - (so.minDifficulty ?? 0)) / 0.05);
    so.hackDifficulty = so.minDifficulty ?? 0;

    let batchRam = this.threads.h * this.COSTS.h;
    batchRam += this.threads.w1 * this.COSTS.w1;
    batchRam += this.threads.g * this.COSTS.g;
    batchRam += this.threads.w2 * this.COSTS.w2;

    const batchTime = this.times.w2 + 2 * this.spacer;
    this.actualMaxBatches = Math.ceil(this.times.w2 / (this.spacer * 4));
    // don't over allocate the batches
    this.maxBatches = Math.max(this.actualMaxBatches - scheduled, 0);

    this.batchMoney *= ns.formulas.hacking.hackChance(so, po);

    this.ramRate = this.batchMoney / batchRam;

    const ramCopy = ram.copy();
    let ramBatches = 0;
    for (let i = 0; i < this.maxBatches; ++i) {
      if (!ramCopy.reserve(this.threads.h * this.COSTS.h)) break;
      if (!ramCopy.reserve(this.threads.w1 * this.COSTS.w1)) break;
      if (!ramCopy.reserve(this.threads.g * this.COSTS.g)) break;
      if (!ramCopy.reserve(this.threads.w2 * this.COSTS.w2)) break;
      ++ramBatches;
    }
    this.maxBatches = Math.min(this.maxBatches, ramBatches);

    this.moneyRate = Math.ceil((this.batchMoney * this.maxBatches) / (batchTime / 1000));

    // Try to keep the current end, but we can't start batches faster than w2 time
    this.end = Math.max(this.end, Date.now() + this.times.w2 + this.spacer);

    return this;
  }

  private weight(): number {
    const homeRam = Math.min(Math.max(this.ns.getServer('home').maxRam, 32), 512);
    const ratio = 0.2 * (Math.log2(homeRam) - 5);
    return this.maxBatches * (this.moneyRate * ratio + this.ramRate * (1 - ratio));
  }
}
