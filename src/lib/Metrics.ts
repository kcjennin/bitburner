import { NS } from '@ns';
import { isPrepped } from '@/lib/utils';

export class Metrics {
  target: string;
  maxMoney: number;
  money: number;
  minSec: number;
  sec: number;
  prepped: boolean;
  chance: number;
  wTime: number;
  delay: number;
  spacer: number;
  greed: number;
  depth: number;
  times: { hack: number; weaken1: number; grow: number; weaken2: number };
  end: number;
  threads: { hack: number; weaken1: number; grow: number; weaken2: number };
  port: number;

  constructor(ns: NS, server: string) {
    this.target = server;
    this.maxMoney = ns.getServerMaxMoney(server);
    this.money = Math.max(ns.getServerMoneyAvailable(server), 1);
    this.minSec = ns.getServerMinSecurityLevel(server);
    this.sec = ns.getServerSecurityLevel(server);
    this.prepped = isPrepped(ns, server);
    this.chance = 0;
    this.wTime = 0;
    this.delay = 0;
    this.spacer = 5;
    this.greed = 0.1;
    this.depth = 0;

    this.times = { hack: 0, weaken1: 0, grow: 0, weaken2: 0 };
    this.end = 0;
    // this.ends = { hack: 0, weaken1: 0, grow: 0, weaken2: 0 };
    this.threads = { hack: 0, weaken1: 0, grow: 0, weaken2: 0 };

    this.port = ns.pid;
  }

  calculate(ns: NS, greed = this.greed) {
    const server = this.target;
    const maxMoney = this.maxMoney;

    this.money = Math.max(ns.getServerMoneyAvailable(server), 1);
    this.sec = ns.getServerSecurityLevel(server);
    this.wTime = ns.getWeakenTime(server);
    this.times.weaken1 = this.wTime;
    this.times.weaken2 = this.wTime;
    this.times.hack = this.wTime * 0.25;
    this.times.grow = this.wTime * 0.8;
    // this.depth = (this.wTime / this.spacer) * 4;

    const hPercent = ns.hackAnalyze(server);
    const amount = maxMoney * greed;
    const hThreads = Math.max(Math.floor(ns.hackAnalyzeThreads(server, amount)), 1);
    const tGreed = hPercent * hThreads;
    // Overestimate by 1% to help with level ups.
    const gThreads = Math.ceil(ns.growthAnalyze(server, maxMoney / (maxMoney - maxMoney * tGreed)) * 1.01);
    this.threads.weaken1 = Math.max(Math.ceil((hThreads * 0.002) / 0.05), 1);
    this.threads.weaken2 = Math.max(Math.ceil((gThreads * 0.004) / 0.05), 1);
    this.threads.hack = hThreads;
    this.threads.grow = gThreads;
    this.chance = ns.hackAnalyzeChance(server);
  }

  calculateGW(ns: NS) {
    const server = this.target;

    this.money = Math.max(ns.getServerMoneyAvailable(server), 1);
    this.sec = ns.getServerSecurityLevel(server);
    this.wTime = ns.getWeakenTime(server);
    this.times.weaken2 = this.wTime;
    this.times.grow = this.wTime * 0.8;
  }
}
