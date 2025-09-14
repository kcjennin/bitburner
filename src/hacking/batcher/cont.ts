/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { NetscriptPort, NS, Player, Server } from '@ns';
import { ServerPool } from '../lib/ServerPool';
import { collectJob, JOB_RAM, submitJob } from '../lib/HGWJob';
import { isPrepped } from '../../lib/utils';
import { prep } from '../lib/util';
import { Expediter } from '../lib/Expediter';
import { STOCK_MAP } from '../../data/stock-map';
import { BitNodeMultiplersCache, getCacheData, ServersCache } from '@/lib/Cache';

type STOCK_ORG = keyof typeof STOCK_MAP;

interface Batch<T> {
  h: T;
  w1: T;
  g: T;
  w2: T;
}

interface BatchInfo {
  target: string;
  rate: number;
  greed: number;
  depth: number;
  threads: Batch<number>;
  times: Batch<number>;
}

function batchTimes(ns: NS, so: Server, po: Player): Batch<number> {
  return {
    h: ns.formulas.hacking.hackTime(so, po),
    w1: ns.formulas.hacking.weakenTime(so, po),
    g: ns.formulas.hacking.growTime(so, po),
    w2: ns.formulas.hacking.weakenTime(so, po),
  };
}

function batchThreads(ns: NS, greed: number, so: Server, po: Player): Batch<number> {
  const moneyMax = so.moneyMax ?? 0;
  const hackPercent = ns.formulas.hacking.hackPercent(so, po);

  so.hackDifficulty = so.minDifficulty ?? 0;
  so.moneyAvailable = moneyMax;

  const h = Math.max(1, Math.round(greed / hackPercent));
  const effGreed = h * hackPercent;
  const batchMoney = moneyMax * effGreed;
  const w1 = Math.ceil((h * 0.002) / 0.05);
  so.moneyAvailable -= batchMoney;

  const g = Math.ceil(ns.formulas.hacking.growThreads(so, po, moneyMax) * 1.05);
  so.moneyAvailable = moneyMax;
  const w2 = Math.ceil((g * 0.004) / 0.05);

  return { h, w1, g, w2 };
}

function calculateBatch(
  ns: NS,
  target: string,
  spacer: number,
  running = 0,
  fixedGreed?: number,
): BatchInfo | undefined {
  const so = ns.getServer(target);
  const po = ns.getPlayer();
  const moneyMax = so.moneyMax ?? 0;

  so.hackDifficulty = so.minDifficulty ?? 0;
  so.moneyAvailable = moneyMax;

  const times = batchTimes(ns, so, ns.getPlayer());
  const maxBatches = Math.floor(times.w1 / (4 * spacer));

  let greed = fixedGreed ?? 0.99;
  const hackPercent = ns.formulas.hacking.hackPercent(so, po);
  if (hackPercent === 0) return undefined;
  const best: Omit<BatchInfo, 'target' | 'times'> = {
    rate: 0,
    depth: 0,
    threads: { h: 0, w1: 0, g: 0, w2: 0 },
    greed,
  };
  while (greed > 0.01) {
    const batchMoney = moneyMax * greed;
    const { h, w1, g, w2 } = batchThreads(ns, greed, so, po);

    let batches = 0;
    const pool = new ServerPool(ns);
    while (batches < maxBatches) {
      if (pool.reserve(h * JOB_RAM.h) === undefined) break;
      if (pool.reserve(w1 * JOB_RAM.w1) === undefined) break;
      if (pool.reserve(g * JOB_RAM.g) === undefined) break;
      if (pool.reserve(w2 * JOB_RAM.w2) === undefined) break;
      batches += 1;
    }
    const actualBatches = Math.max(Math.min(maxBatches - running, batches), 0);

    const totalMoney = actualBatches * batchMoney * ns.formulas.hacking.hackChance(so, po);
    const batchRate = totalMoney / times.w1;
    if (fixedGreed !== undefined) {
      return {
        target,
        times,
        rate: batchRate,
        depth: actualBatches + running,
        threads: { h, w1, g, w2 },
        greed,
      };
    }
    if (batchRate > best.rate) {
      best.rate = batchRate;
      best.depth = actualBatches + running;
      best.threads.h = h;
      best.threads.w1 = w1;
      best.threads.g = g;
      best.threads.w2 = w2;
      best.greed = greed;
    }

    greed -= Math.max(0.01, hackPercent);
  }

  if (best.rate === 0) return undefined;
  return {
    target,
    times,
    ...best,
  };
}

function updatePlayerHacking(ns: NS, po: Player, exp: number) {
  po.exp.hacking += Math.round(exp * getCacheData(ns, BitNodeMultiplersCache).HackExpGain);

  const newSkill = ns.formulas.skills.calculateSkill(po.exp.hacking, po.mults.hacking);
  po.skills.hacking = Math.round(newSkill * getCacheData(ns, BitNodeMultiplersCache).HackingLevelMultiplier);
}

export async function main(ns: NS): Promise<void> {
  const {
    debug,
    exclude,
    target: cliTarget,
    spacer,
    stock,
  } = ns.flags([
    ['debug', false],
    ['exclude', ''],
    ['target', ''],
    ['spacer', 5],
    ['stock', 0],
  ]) as { debug: boolean; exclude: string; target: string; spacer: number; stock: number };
  const excludes = exclude.split(',');

  ns.disableLog('ALL');
  if (debug) {
    ns.enableLog('exec');
  }

  ns.clearLog();
  ns.clearPort(ns.pid);
  ns.ui.openTail();

  const stockPort: NetscriptPort | undefined = stock !== 0 ? ns.getPortHandle(stock) : undefined;

  let targetInfo;
  if (cliTarget !== '') {
    targetInfo = calculateBatch(ns, cliTarget, spacer);
    if (targetInfo === undefined) throw 'Invalid target.';
  } else {
    // get the batch information for all servers
    const filtered: BatchInfo[] = [];
    const po = ns.getPlayer();
    const bestServers = getCacheData(ns, ServersCache)
      .filter(
        (s) =>
          !excludes.includes(s.hostname) &&
          s.hasAdminRights &&
          po.skills.hacking >= (s.requiredHackingSkill ?? Infinity) &&
          (s.moneyMax ?? 0) > 0,
      )
      .map((so) => ({ so, weight: (so.moneyMax ?? 0) / ns.formulas.hacking.weakenTime(so, po) }))
      .sort((a, b) => b.weight - a.weight);

    for (const { so } of bestServers) {
      try {
        const b = calculateBatch(ns, so.hostname, spacer);
        if (b !== undefined) filtered.push(b);
      } catch (error) {
        ns.tprint(`Failed to calculate batch on server: ${so.hostname}`);
        ns.tprint(error);
      }
    }

    if (filtered.length === 0) throw 'Failed to find a target.';
    // get the batch information for the best server
    targetInfo = filtered.reduce((best, b) => (best.rate > b.rate ? best : b));
  }
  const { target, greed } = targetInfo;
  let { rate, depth, times, threads } = targetInfo;

  if (!isPrepped(ns, target)) await prep(ns, new Expediter(ns), target);

  let running = 0,
    endTime = Date.now() + times.w1 + 200,
    completed = 0,
    cycleTime = 0,
    stockManipulate: 'g' | 'h' | 'x' = 'x';
  if (!debug) {
    const timer = setInterval(() => {
      ns.clearLog();
      ns.print(`Target: ${target}`);
      ns.print(`Income: $${ns.formatNumber(rate * 1000)}/s`);
      ns.print(`Depth:  ${depth} / ${Math.floor(times.w1 / (spacer * 4))}`);
      ns.print(`        ${running} | ${completed} | ${ns.formatNumber(cycleTime, 3, 1000, true)} ms`);
      ns.print(`Stock:  ${stockManipulate}`);
    }, 1000);
    ns.atExit(() => clearInterval(timer));
  }

  const expGained: number[] = [];
  while (true) {
    const cycleStart = Date.now();

    const pool = new ServerPool(ns);

    const po = ns.getPlayer();
    const so = ns.getServer(target);
    if (so.hackDifficulty !== so.minDifficulty || so.moneyAvailable !== so.moneyMax) {
      while (running > 0) {
        const { type } = await collectJob(ns);
        if (type === 'w2') {
          running -= 1;
          completed += 1;
          expGained.shift();
        }
      }
      if (!isPrepped(ns, target)) await prep(ns, new Expediter(ns), target);
      continue;
    }

    // recalculate times from current player level
    const bi = calculateBatch(ns, target, spacer, running, greed);
    if (bi !== undefined) {
      ({ rate, depth, times } = bi);
    } else {
      times = batchTimes(ns, so, po);
    }

    // update hacking level based on flying batches
    updatePlayerHacking(
      ns,
      po,
      expGained.reduce((acc, x) => acc + x, 0),
    );
    let hacking = po.skills.hacking;

    // do stock stuff if needed
    if (stockPort !== undefined && !stockPort.empty() && target in STOCK_MAP) {
      const stockData: Record<string, boolean> = JSON.parse(stockPort.peek());
      const targetSym = STOCK_MAP[target as STOCK_ORG];
      if (stockData[targetSym] !== undefined) {
        stockManipulate = stockData[targetSym] ? 'g' : 'h';
      }
    }

    while (running < depth) {
      const hosts = {
        h: pool.reserve(threads.h * JOB_RAM.h),
        w1: pool.reserve(threads.w1 * JOB_RAM.w1),
        g: pool.reserve(threads.g * JOB_RAM.g),
        w2: pool.reserve(threads.w2 * JOB_RAM.w2),
      };
      if (Object.values(hosts).some((h) => h === undefined)) break;

      // can't finish faster than a w1
      if (endTime < Date.now() + times.w1) endTime = Date.now() + times.w1;
      endTime +=
        (await submitJob(ns, hosts.h!, threads.h, 'h', target, ns.pid, times.h, endTime, stockManipulate === 'h')) +
        spacer;
      endTime += (await submitJob(ns, hosts.w1!, threads.w1, 'w1', target, ns.pid, times.w1, endTime)) + spacer;
      endTime +=
        (await submitJob(ns, hosts.g!, threads.g, 'g', target, ns.pid, times.g, endTime, stockManipulate === 'g')) +
        spacer;
      endTime += (await submitJob(ns, hosts.w2!, threads.w2, 'w2', target, ns.pid, times.w2, endTime)) + spacer;

      // factor in experience before recalculating the threads
      const batchExp = (threads.h + threads.w1 + threads.g + threads.w2) * ns.formulas.hacking.hackExp(so, po);
      updatePlayerHacking(ns, po, batchExp);
      expGained.push(batchExp);

      // recalculate threads
      if (po.skills.hacking !== hacking) {
        if (debug) ns.tprint(`Old: ${hacking} -- New: ${po.skills.hacking} (${ns.formatNumber(po.exp.hacking)})`);
        if (po.skills.hacking < hacking) throw `Bad hacking calculation: ${po.skills.hacking} -- ${hacking}`;

        // new threads
        threads = batchThreads(ns, greed, so, po);

        // save hacking level for future batches
        hacking = po.skills.hacking;
      }

      running += 1;
    }

    cycleTime = Date.now() - cycleStart;
    // wait for a batch to end
    while (true) {
      const { type } = await collectJob(ns);
      if (type === 'w2') {
        running -= 1;
        completed += 1;
        expGained.shift();
        break;
      }
    }
  }
}
