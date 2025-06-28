import { Job } from '@/lib/Job';
import { Metrics } from '@/lib/Metrics';
import { RamNet } from '@/lib/RamNet';
import {
  aquireTarget,
  checkTarget,
  copyScripts,
  getServers,
  isPrepped,
  JOB_TYPES,
  prep,
  releaseTarget,
  SCRIPTS,
  WORKERS,
} from '@/lib/utils';
import { NS } from '@ns';

const OFFSETS = { hack: 0, weaken1: 1, grow: 2, weaken2: 3 };

export async function main(ns: NS): Promise<void> {
  ns.disableLog('ALL');
  ns.ui.openTail();

  let batchCount = 0;
  while (true) {
    const dataPort = ns.getPortHandle(ns.pid);
    dataPort.clear();

    let target = 'n00dles';
    const servers = getServers(ns, (server) => {
      target = checkTarget(ns, server, target, ns.fileExists('Formulas.exe', 'home'));
      copyScripts(ns, server, WORKERS, true);
      return ns.hasRootAccess(server);
    });
    const ramNet = new RamNet(ns, servers);
    const metrics = new Metrics(ns, target);

    releaseTarget(ns, target, ns.pid);
    if (!aquireTarget(ns, target, ns.pid)) {
      throw new Error(`Failed to aquire the target ${target}`);
    }
    ns.atExit(() => releaseTarget(ns, target, ns.pid), 'TARGET');

    if (!isPrepped(ns, target)) {
      const success = await prep(ns, metrics, ramNet);
      if (!success) {
        throw new Error('Failed to prep server.');
      }
    }

    const success = optimizeBatch(ns, metrics, ramNet);
    if (!success) {
      throw new Error('Failed to optimize batch for server.');
    }
    metrics.calculate(ns);

    const batch = [];
    batchCount++;
    for (const type of JOB_TYPES) {
      metrics.ends[type] = Date.now() + metrics.wTime + metrics.spacer * OFFSETS[type];
      const job = new Job(type, metrics, batchCount);
      job.batch = batchCount;
      if (!ramNet.assign(job)) {
        ns.print(`ERROR: Unable to assign ${type}. Dumping debug info.`);
        ns.print(job);
        ns.print(metrics);
        ramNet.printBlocks(ns);
        return;
      }
      batch.push(job);
    }

    for (const job of batch) {
      job.end += metrics.delay;
      const jobPid = ns.exec(
        SCRIPTS[job.type],
        job.server,
        { threads: job.threads, temporary: true },
        JSON.stringify(job),
      );
      if (!jobPid) {
        throw new Error(`Unable to deploy ${job.type}`);
      }
      const tPort = ns.getPortHandle(jobPid);
      await tPort.nextWrite();
      metrics.delay += tPort.read();
    }

    const timer = setInterval(() => {
      ns.clearLog();
      const hackAmount = metrics.maxMoney * metrics.greed;
      ns.print(`Hacking $${ns.formatNumber(hackAmount)} (${ns.formatPercent(metrics.greed)}) from ${metrics.target}`);
      ns.print(`Running batch: ETA ${ns.tFormat(metrics.ends.weaken2 - Date.now())}`);
    }, 1000);
    ns.atExit(() => clearInterval(timer));

    await dataPort.nextWrite();
    dataPort.clear();
    clearInterval(timer);
  }
}

function optimizeBatch(ns: NS, metrics: Metrics, ramNet: RamNet): boolean {
  const maxThreads = ramNet.maxBlockSize() / 1.75;
  const maxMoney = metrics.maxMoney;
  const hPercent = ns.hackAnalyze(metrics.target);

  const minGreed = 0.001;
  const stepValue = 0.001;
  let greed = 0.05;
  let hThreads, gThreads, amount;
  while (greed > minGreed) {
    amount = greed * maxMoney;
    hThreads = Math.max(Math.floor(ns.hackAnalyzeThreads(metrics.target, amount)), 1);
    const tGreed = hThreads * hPercent;
    gThreads = Math.ceil(ns.growthAnalyze(metrics.target, maxMoney / (maxMoney - maxMoney * tGreed)));

    // If we have servers that can run the jobs
    if (Math.max(hThreads, gThreads) <= maxThreads) {
      const wThreads1 = Math.max(Math.ceil((hThreads * 0.002) / 0.05), 1);
      const wThreads2 = Math.max(Math.ceil((gThreads * 0.004) / 0.05), 1);

      const threadCosts = [hThreads * 1.7, wThreads1 * 1.75, gThreads * 1.75, wThreads2 * 1.75];

      const pRam = ramNet.cloneBlocks();
      let found;
      for (const cost of threadCosts) {
        found = false;
        for (const block of pRam) {
          if (block.ram < cost) {
            continue;
          }
          found = true;
          block.ram -= cost;
          break;
        }
        if (found) {
          continue;
        }

        // If we're unable to assign a job, break and try again
        break;
      }
      // If we found them all, set the metrics
      if (found) {
        metrics.greed = greed;
        metrics.threads = { hack: hThreads, weaken1: wThreads1, grow: gThreads, weaken2: wThreads2 };
        return true;
      }
    }
    // Greed is too high
    greed -= stepValue;
  }
  // If we got this far then we can't batch this target at all.
  ns.print(`Final threads, Hack: ${hThreads}, Grow: ${gThreads}, Amount: ${amount}`);
  throw new Error(`Not enough RAM to run a single batch.`);
}
