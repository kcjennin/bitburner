import { NS } from '@ns';
import { Expediter } from '@/hacking/jit/Expediter';

export class Target {
  private readonly COSTS = { hack: 1.7, weaken1: 1.75, grow: 1.75, weaken2: 1.75 };
  times: { hack: number; weaken1: number; grow: number; weaken2: number };
  threads: { hack: number; weaken1: number; grow: number; weaken2: number };
  ramRate: number;
  moneyRate: number;
  delay: number;
  end: number;
  batchMoney: number;
  maxBatches: number;

  constructor(private ns: NS, public name: string, public spacer: number, public greed: number) {
    this.times = {
      hack: 0,
      weaken1: 0,
      grow: 0,
      weaken2: 0,
    };
    this.threads = {
      hack: 0,
      weaken1: 0,
      grow: 0,
      weaken2: 0,
    };
    this.ramRate = 0;
    this.moneyRate = 0;
    this.delay = 0;
    this.end = 0;
    this.batchMoney = 0;
    this.maxBatches = 0;
  }

  update(greed: number = this.greed): Target {
    const ns = this.ns;
    const so = ns.getServer(this.name);
    const po = ns.getPlayer();

    so.hackDifficulty = so.minDifficulty ?? 0;
    so.moneyAvailable = so.moneyMax ?? 0;

    this.times.hack = Math.ceil(ns.formulas.hacking.hackTime(so, po));
    this.times.weaken1 = Math.ceil(ns.formulas.hacking.weakenTime(so, po));
    this.times.grow = Math.ceil(ns.formulas.hacking.growTime(so, po));
    this.times.weaken2 = Math.ceil(ns.formulas.hacking.weakenTime(so, po));

    const hPercent = ns.formulas.hacking.hackPercent(so, po);
    this.threads.hack = Math.ceil(greed / hPercent);
    this.batchMoney = Math.floor(so.moneyAvailable * hPercent) * this.threads.hack;

    so.moneyAvailable -= this.batchMoney;
    so.hackDifficulty += this.threads.hack * 0.002;

    this.threads.weaken1 = Math.ceil((so.hackDifficulty - (so.minDifficulty ?? 0)) / 0.05);
    so.hackDifficulty = so.minDifficulty ?? 0;

    this.threads.grow = ns.formulas.hacking.growThreads(so, po, so.moneyMax ?? 0);
    so.moneyAvailable = so.moneyMax ?? 0;
    so.hackDifficulty += this.threads.grow * 0.004;

    this.threads.weaken2 = Math.ceil((so.hackDifficulty - (so.minDifficulty ?? 0)) / 0.05);
    so.hackDifficulty = so.minDifficulty ?? 0;

    let batchRam = this.threads.hack * this.COSTS.hack;
    batchRam += this.threads.weaken1 * this.COSTS.weaken1;
    batchRam += this.threads.grow * this.COSTS.grow;
    batchRam += this.threads.weaken2 * this.COSTS.weaken2;

    const batchTime = this.times.weaken2 + 2 * this.spacer;
    this.maxBatches = Math.ceil(this.times.weaken2 / (this.spacer * 4));

    this.batchMoney *= ns.formulas.hacking.hackChance(so, po);

    this.ramRate = this.batchMoney / batchRam;

    const ram = new Expediter(ns);
    let ramBatches = 0;
    for (let i = 0; i < this.maxBatches; ++i) {
      if (!ram.reserve(this.threads.hack * this.COSTS.hack)) break;
      if (!ram.reserve(this.threads.weaken1 * this.COSTS.weaken1)) break;
      if (!ram.reserve(this.threads.grow * this.COSTS.grow)) break;
      if (!ram.reserve(this.threads.weaken2 * this.COSTS.weaken2)) break;
      ++ramBatches;
    }
    this.maxBatches = ramBatches;

    this.moneyRate = Math.ceil((this.batchMoney * this.maxBatches) / (batchTime / 1000));

    this.end = Date.now() + this.times.weaken2 + this.spacer;

    return this;
  }
}
