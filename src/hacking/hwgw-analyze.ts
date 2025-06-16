import { NS } from '@ns';

const HACK_TARGET = 0.1;

/** @param {NS} ns */
export async function main(ns: NS): Promise<void> {
  if (ns.args.length !== 2) return ns.exit();
  const [t, p] = ns.args.map(Number);

  let lo = 1,
    hi = t,
    best = null;

  while (lo <= hi) {
    const h = Math.floor((lo + hi) / 2);

    const hackAmount = ns.hackAnalyze(ns.getServer().hostname) * h;
    if (hackAmount >= HACK_TARGET) {
      hi = h - 1;
      continue;
    }

    const hackSec = ns.hackAnalyzeSecurity(h);
    const weaken1 = Math.ceil(hackSec / ns.weakenAnalyze(1));

    const growMult = 1 / (1 - hackAmount);
    const grow = Math.ceil(ns.growthAnalyze(ns.getServer().hostname, growMult));
    const weaken2 = Math.ceil(ns.growthAnalyzeSecurity(grow) / ns.weakenAnalyze(1));

    const total = h + weaken1 + grow + weaken2;

    if (total <= t) {
      best = [h, weaken1, grow, weaken2];
      lo = h + 1; // try more hack threads
    } else {
      hi = h - 1; // too many threads try fewer
    }
  }

  ns.tryWritePort(p, best ?? 'NO SOLUTION');
}
