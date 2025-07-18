import { NS, ScriptArg } from '@ns';
import { RamNet } from '@/lib/RamNet';
import { Metrics } from '@/lib/Metrics';

export const WORKERS = ['/lib/workers/tHack.js', '/lib/workers/tWeaken.js', '/lib/workers/tGrow.js'];
export const SCRIPTS = { hack: WORKERS[0], weaken1: WORKERS[1], grow: WORKERS[2], weaken2: WORKERS[1] };

export type Block = { server: string; ram: number };

export async function main(ns: NS): Promise<void> {
  ns.print('This is a library file.');
}

export function getServers(ns: NS): string[] {
  const z: (t: string) => string[] = (t) => [
    t,
    ...ns
      .scan(t)
      .slice(t !== 'home' ? 1 : 0)
      .flatMap(z),
  ];
  return z('home');
}

/** Sorting function to get the best server for hacking. */
export function checkTarget(ns: NS, server: string, target = 'n00dles', forms = false): string {
  // if (!ns.hasRootAccess(server) || peekTarget(ns, server) !== ns.pid) {
  if (!ns.hasRootAccess(server)) {
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

      if (ns.formulas.hacking.weakenTime(serverSim, player) > 5 * 60 * 1000) {
        // don't want to run anything super long, may change later
        return target;
      }

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
    let script, mode;
    /*
    Modes:
    0: Security only
    1: Money only
    2: One shot
    */

    if (money < maxMoney) {
      gThreads = Math.ceil(ns.growthAnalyze(metrics.target, maxMoney / money));
      wThreads2 = Math.ceil(ns.growthAnalyzeSecurity(gThreads) / 0.05);
    }
    if (sec > minSec) {
      wThreads1 = Math.ceil((sec - minSec) * 20);
      if (!(wThreads1 + wThreads2 + gThreads <= totalThreads && gThreads <= maxThreads)) {
        gThreads = 0;
        wThreads2 = 0;
        batchCount = Math.ceil(wThreads1 / totalThreads);
        if (batchCount > 1) wThreads1 = totalThreads;
        mode = 0;
      } else mode = 2;
    } else if (gThreads > maxThreads || gThreads + wThreads2 > totalThreads) {
      mode = 1;
      const oldG = gThreads;
      wThreads2 = Math.max(Math.floor(totalThreads / 13.5), 1);
      gThreads = Math.floor(wThreads2 * 12.5);
      batchCount = Math.ceil(oldG / gThreads);
    } else mode = 2;

    // Big buffer here, since all the previous calculations can take a while. One second should be more than enough.
    const wEnd1 = Date.now() + wTime + 1000;
    const gEnd = wEnd1 + metrics.spacer;
    const wEnd2 = gEnd + metrics.spacer;

    // "metrics" here is basically a mock Job object. Again, this is just an artifact of repurposed old code.
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

    // Actually assigning threads. We actually allow grow threads to be spread out in mode 1.
    // This is because we don't mind if the effect is a bit reduced from higher security unlike a normal batcher.
    // We're not trying to grow a specific amount, we're trying to grow as much as possible.
    for (const block of pRam) {
      while (block.ram >= 1.75) {
        const bMax = Math.floor(block.ram / 1.75);
        let threads = 0;
        if (wThreads1 > 0) {
          script = SCRIPTS.weaken1;
          mMetrics.type = 'pWeaken1';
          mMetrics.time = wTime;
          mMetrics.end = wEnd1;
          threads = Math.min(wThreads1, bMax);
          if (wThreads2 === 0 && wThreads1 - threads <= 0) mMetrics.report = true;
          wThreads1 -= threads;
        } else if (wThreads2 > 0) {
          script = SCRIPTS.weaken2;
          mMetrics.type = 'pWeaken2';
          mMetrics.time = wTime;
          mMetrics.end = wEnd2;
          threads = Math.min(wThreads2, bMax);
          if (wThreads2 - threads === 0) mMetrics.report = true;
          wThreads2 -= threads;
        } else if (gThreads > 0 && mode === 1) {
          script = SCRIPTS.grow;
          mMetrics.type = 'pGrow';
          mMetrics.time = gTime;
          mMetrics.end = gEnd;
          threads = Math.min(gThreads, bMax);
          mMetrics.report = false;
          gThreads -= threads;
        } else if (gThreads > 0 && bMax >= gThreads) {
          script = SCRIPTS.grow;
          mMetrics.type = 'pGrow';
          mMetrics.time = gTime;
          mMetrics.end = gEnd;
          threads = gThreads;
          mMetrics.report = false;
          gThreads = 0;
        } else break;
        mMetrics.server = block.server;
        const pid = ns.exec(script, block.server, { threads: threads, temporary: true }, JSON.stringify(mMetrics));
        if (!pid) throw new Error('Unable to assign all jobs.');
        block.ram -= 1.75 * threads;
      }
    }

    // Fancy UI stuff to update you on progress.
    const tEnd = ((mode === 0 ? wEnd1 : wEnd2) - Date.now()) * batchCount + Date.now();
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
      }
      ns.print(`Security: +${ns.formatNumber(sec - minSec)}`);
      ns.print(`Money: $${ns.formatNumber(money)}/${ns.formatNumber(maxMoney)}`);
      const time = tEnd - Date.now();
      ns.print(`Estimated time remaining: ${ns.tFormat(time)}`);
      ns.print(`~${batchCount} ${batchCount === 1 ? 'batch' : 'batches'}.`);
    }, 200);
    ns.atExit(() => clearInterval(timer));

    // Wait for the last weaken to finish.
    do await dataPort.nextWrite();
    while (!dataPort.read().startsWith('pWeaken'));
    clearInterval(timer);
    await ns.sleep(100);

    money = ns.getServerMoneyAvailable(metrics.target);
    sec = ns.getServerSecurityLevel(metrics.target);
  }
  return true;
}

function buildServerGraph(ns: NS, start: string): Record<string, string[]> {
  const graph: Record<string, string[]> = {};
  const servers: string[] = [start];
  let idx = 0;

  while (idx < servers.length) {
    graph[servers[idx]] = ns.scan(servers[idx]);
    for (const newServer of graph[servers[idx]]) {
      if (!servers.includes(newServer)) {
        servers.push(newServer);
      }
    }
    ++idx;
  }
  return graph;
}

function bfsPath(graph: Record<string, string[]>, start: string, goal: string): string[] {
  const queue: string[] = [start];
  const visited = new Set<string>([start]);
  const parent: Record<string, string | null> = { [start]: null };

  while (queue.length > 0) {
    const node = queue.shift();
    if (node === undefined) {
      continue; // Skip if node is undefined
    }
    if (node === goal) {
      const path: string[] = [];
      let current: string | null = goal;
      while (current !== null) {
        path.push(current);
        current = parent[current];
      }
      return path.reverse().slice(1);
    }

    for (const neighbor of graph[node]) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        parent[neighbor] = node;
        queue.push(neighbor);
      }
    }
  }

  throw new Error('Failed to find path to target.');
}

export function connectPath(ns: NS, start: string, target: string): string[] {
  if (start === 'home') {
    const path = [target];
    let last = target;

    while (last !== 'home') {
      last = ns.scan(last)[0];
      path.push(last);
    }

    return path.reverse().slice(1);
  } else {
    const graph = buildServerGraph(ns, start);
    return bfsPath(graph, start, target);
  }
}

export function tryRun(ns: NS, script: string, ...args: ScriptArg[]): number | undefined {
  if (!ns.isRunning(script, 'home', ...args)) {
    return ns.run(script, 1, ...args);
  }
  return undefined;
}

export function getRam(ns: NS): number {
  return ns.getServerMaxRam('home') - ns.getServerUsedRam('home');
}
