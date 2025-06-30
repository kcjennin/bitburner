import { NS } from '@ns';
import { RamNet } from '@/lib/RamNet';
import { Metrics } from './Metrics';

const TARGETS_FILE = '/data/targets.json';

export const COSTS = { hack: 1.7, weaken1: 1.75, grow: 1.75, weaken2: 1.75 };
export const WORKERS = ['/lib/workers/tHack.js', '/lib/workers/tWeaken.js', '/lib/workers/tGrow.js'];
export const SCRIPTS = { hack: WORKERS[0], weaken1: WORKERS[1], grow: WORKERS[2], weaken2: WORKERS[1] };

export const JOB_TYPES = ['hack', 'weaken1', 'grow', 'weaken2'] as const;
export type JobType = (typeof JOB_TYPES)[number];

export type Block = { server: string; ram: number };

export async function main(ns: NS): Promise<void> {
  ns.print('This is a library file.');
}

/** Get's all the available servers on the network that pass the provided condition. */
export function getServers(
  ns: NS,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  condition = (hostname: string) => true,
  hostname = 'home',
  servers: string[] = [],
  visited: string[] = [],
): string[] {
  if (visited.includes(hostname)) {
    return [];
  }
  visited.push(hostname);

  if (condition(hostname)) {
    servers.push(hostname);
  }

  const connectedNodes = ns.scan(hostname);

  if (hostname !== 'home') {
    connectedNodes.shift();
  }

  for (const node of connectedNodes) {
    getServers(ns, condition, node, servers, visited);
  }
  return servers;
}

/** Sorting function to get the best server for hacking. */
export function checkTarget(ns: NS, server: string, target = 'n00dles', forms = false): string {
  // if (!ns.hasRootAccess(server) || peekTarget(ns, server) !== ns.pid) {
  if (!ns.hasRootAccess(server)) {
    return target;
  }

  if (ns.getWeakenTime(server) > 300000) {
    return target;
  }

  const player = ns.getPlayer();
  const serverSim = ns.getServer(server);
  const pSim = ns.getServer(target);

  let previousScore: number, currentScore: number;

  if ((serverSim.requiredHackingSkill ?? Infinity) <= player.skills.hacking / (forms ? 1 : 2)) {
    if (forms) {
      serverSim.hackDifficulty = serverSim.minDifficulty;
      pSim.hackDifficulty = pSim.minDifficulty;

      previousScore =
        ((pSim.moneyMax ?? 0) / ns.formulas.hacking.weakenTime(pSim, player)) *
        ns.formulas.hacking.hackTime(pSim, player);
      currentScore =
        ((serverSim.moneyMax ?? 0) / ns.formulas.hacking.weakenTime(serverSim, player)) *
        ns.formulas.hacking.hackTime(serverSim, player);
    } else {
      previousScore = (pSim.moneyMax ?? 0) / (pSim.minDifficulty ?? Infinity);
      currentScore = (serverSim.moneyMax ?? 0) / (serverSim.minDifficulty ?? Infinity);
    }

    if (currentScore > previousScore) {
      target = server;
    }
  }
  return target;
}

/** Copy over scripts which checking to make sure we have root access. */
export function copyScripts(ns: NS, server: string, scripts: string[], overwrite = false) {
  for (const script of scripts) {
    if ((!ns.fileExists(script, server) || overwrite) && ns.hasRootAccess(server)) {
      ns.scp(script, server);
    }
  }
}

/** Check that a server is at max money and min security. */
export function isPrepped(ns: NS, server: string): boolean {
  const eps = 0.0001;
  const maxMoney = ns.getServerMaxMoney(server);
  const money = ns.getServerMoneyAvailable(server);
  const minSec = ns.getServerMinSecurityLevel(server);
  const sec = ns.getServerSecurityLevel(server);
  const secFix = Math.abs(sec - minSec) < eps;
  return money === maxMoney && secFix;
}

export async function prep(ns: NS, metrics: Metrics, ramNet: RamNet) {
  const maxMoney = metrics.maxMoney;
  const minSec = metrics.minSec;
  let money = metrics.money;
  let sec = metrics.sec;

  while (!isPrepped(ns, metrics.target)) {
    const wTime = ns.getWeakenTime(metrics.target);
    const gTime = wTime * 0.8;
    const dataPort = ns.getPortHandle(ns.pid);
    dataPort.clear();

    const pRam = ramNet.cloneBlocks();
    const maxThreads = Math.floor(ramNet.maxBlockSize() / 1.75);
    const totalThreads = ramNet.prepThreads();

    let wThreads1 = 0;
    let wThreads2 = 0;
    let gThreads = 0;
    let batchCount = 1;
    // Modes: 0: Security, 1: Money, 2: One Shot
    let mode = 0;
    let script;

    if (money < maxMoney) {
      gThreads = Math.ceil(ns.growthAnalyze(metrics.target, maxMoney / money));
      wThreads2 = Math.ceil(ns.growthAnalyzeSecurity(gThreads) * 20);
    }
    if (sec > minSec) {
      wThreads1 = Math.ceil((sec - minSec) * 20);
      if (!(wThreads1 + wThreads2 + gThreads <= totalThreads && gThreads <= maxThreads)) {
        // If we can't do it in one shot switch to security mode first
        gThreads = 0;
        wThreads2 = 0;
        batchCount = Math.ceil(wThreads2 / totalThreads);
        if (batchCount > 1) {
          mode = 0;
        }
      } else {
        mode = 2;
      }
    } else if (gThreads > maxThreads || gThreads + wThreads2 > maxThreads) {
      // If we can't do a one-shot while growing, split it up
      mode = 1;
      const oldG = gThreads;
      wThreads2 = Math.max(Math.floor(totalThreads / 13.5), 1);
      gThreads = Math.floor(wThreads2 * 12.5);
      // number of batches to finish growing the server
      batchCount = Math.ceil(oldG / gThreads);
    } else {
      // We have enough resources to do it all in one shot
      mode = 2;
    }

    const wEnd1 = Date.now() + wTime + 1000;
    const gEnd = wEnd1 + metrics.spacer;
    const wEnd2 = gEnd + metrics.spacer;

    const mMetrics = {
      batch: 'prep',
      target: metrics.target,
      type: 'none',
      time: 0,
      end: 0,
      port: ns.pid,
      report: false,
      server: 'none',
    };

    for (const block of pRam) {
      while (block.ram >= 1.75) {
        const bMax = Math.floor(block.ram / 1.75);
        let threads = 0;
        if (wThreads1 > 0) {
          script = SCRIPTS.weaken1;
          mMetrics.type = 'weaken1';
          mMetrics.time = wTime;
          mMetrics.end = wEnd1;
          threads = Math.min(wThreads1, bMax);
          if (wThreads2 === 0 && wThreads1 - threads <= 0) {
            mMetrics.report = true;
          }
          wThreads1 -= threads;
        } else if (wThreads2 > 0) {
          script = SCRIPTS.weaken2;
          mMetrics.type = 'weaken2';
          mMetrics.time = wTime;
          mMetrics.end = wEnd2;
          threads = Math.min(wThreads2, bMax);
          if (wThreads2 - threads === 0) {
            mMetrics.report = true;
          }
          wThreads2 -= threads;
        } else if (gThreads > 0 && mode === 1) {
          script = SCRIPTS.grow;
          mMetrics.type = 'grow';
          mMetrics.time = gTime;
          mMetrics.end = gEnd;
          threads = Math.min(gThreads, bMax);
          mMetrics.report = false;
          gThreads -= threads;
        } else if (gThreads > 0 && bMax > gThreads) {
          script = SCRIPTS.grow;
          mMetrics.type = 'grow';
          mMetrics.time = gTime;
          mMetrics.end = gEnd;
          threads = gThreads;
          mMetrics.report = false;
          gThreads = 0;
        } else {
          break;
        }
        mMetrics.server = block.server;
        const pid = ns.exec(script, block.server, { threads: threads, temporary: true }, JSON.stringify(mMetrics));
        if (!pid) {
          ns.print(`Failed executing ${script} on ${block.server} with ${threads} threads.`);
          throw new Error('Prep unable to assign all jobs.');
        }
        block.ram -= 1.75 * threads;
      }
    }

    // UI stuff for progress
    const tEnd = ((mode === 0 ? wEnd1 : wEnd2) - Date.now()) * Math.max(batchCount, 1) + Date.now();
    const timer = setInterval(() => {
      ns.clearLog();
      switch (mode) {
        case 0:
          ns.print(`Weakening security on ${metrics.target}...`);
          break;
        case 1:
          ns.print(`Maximizing money on ${metrics.target}...`);
          break;
        case 2:
          ns.print(`Finalizing preparation on ${metrics.target}...`);
          break;
      }
      ns.print(`Security: +${ns.formatNumber(sec - minSec, 3)}`);
      ns.print(`Money: $${ns.formatNumber(money, 2)}/${ns.formatNumber(maxMoney, 2)}`);
      const time = tEnd - Date.now();
      ns.print(`Estimated time remaining: ${ns.tFormat(time)}`);
      ns.print(`~${batchCount} ${batchCount === 1 ? 'batch' : 'batches'}`);
    }, 200);
    ns.atExit(() => clearInterval(timer));

    // Wait for the last weaken
    do {
      await dataPort.nextWrite();
    } while (!dataPort.read().startsWith('weaken'));
    clearInterval(timer);
    await ns.sleep(100);

    money = ns.getServerMoneyAvailable(metrics.target);
    sec = ns.getServerSecurityLevel(metrics.target);
  }
  return true;
}

function readTargets(ns: NS): Record<string, number> {
  if (!ns.fileExists(TARGETS_FILE)) {
    return {};
  } else {
    return JSON.parse(ns.read(TARGETS_FILE));
  }
}

function writeTargets(ns: NS, targets: Record<string, number>): void {
  ns.write(TARGETS_FILE, JSON.stringify(targets), 'w');
}

export function aquireTarget(ns: NS, target: string, pid: number): boolean {
  const targets = readTargets(ns);
  if (targets[target] === pid) {
    return true;
  } else if (targets[target]) {
    return false;
  }
  targets[target] = pid;
  writeTargets(ns, targets);
  return true;
}

export function releaseTarget(ns: NS, target: string, pid: number): boolean {
  const targets = readTargets(ns);
  if (targets[target] === pid) {
    delete targets[target];
    writeTargets(ns, targets);
    return true;
  }
  return false;
}

export function peekTarget(ns: NS, target: string): number {
  const targets = readTargets(ns);
  return targets[target] ?? ns.pid;
}
