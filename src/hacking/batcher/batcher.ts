import { NS } from '@ns';
import { Deque } from '@/lib/Deque';
import { Job, JOB_TYPES } from '@/lib/Job';
import { Metrics } from '@/lib/Metrics';
import { RamNet } from '@/lib/RamNet';
import {
  // aquireTarget,
  checkTarget,
  copyScripts,
  getServers,
  isPrepped,
  prep,
  // releaseTarget,
  WORKERS,
  SCRIPTS,
} from '@/lib/utils';

export async function main(ns: NS): Promise<void> {
  ns.disableLog('ALL');
  ns.ui.openTail();

  while (true) {
    const dataPort = ns.getPortHandle(ns.pid);
    dataPort.clear();

    let target = 'n00dles';
    const servers = getServers(ns).filter((server) => {
      target = checkTarget(ns, server, target, ns.fileExists('Formulas.exe', 'home'));
      copyScripts(ns, server, WORKERS, true);
      return ns.hasRootAccess(server);
    });
    target = ns.args[0]?.toString() ?? target;
    const ramNet = new RamNet(ns, servers);
    const metrics = new Metrics(ns, target);

    if (!isPrepped(ns, target)) {
      const success = await prep(ns, metrics, ramNet);
      if (!success) {
        throw new Error('Failed to prep server.');
      }
    }

    ns.clearLog();
    ns.print('Optimizing...');

    await optimizeShotgun(ns, metrics, ramNet);
    metrics.calculate(ns);

    const jobs: Deque<Job> = new Deque();
    let batchCount = 0;

    metrics.end = Date.now() + metrics.wTime + metrics.spacer;

    while (batchCount++ < metrics.depth) {
      for (const type of JOB_TYPES) {
        metrics.end += metrics.spacer;

        const job = new Job(type, metrics, batchCount);
        if (!ramNet.assign(job)) {
          ns.print(`ERROR: Unable to assign ${job.type}. Dumping debug info.`);
          ns.print(job);
          ns.print(metrics);
          ramNet.printBlocks(ns);
          return;
        }
        jobs.pushBack(job);
      }
    }

    for (const job of jobs) {
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

    const batchAmount = metrics.maxMoney * metrics.greed * metrics.depth;
    const timer = setInterval(() => {
      ns.clearLog();
      ns.print(`Hacking $${ns.formatNumber(batchAmount)} from ${metrics.target}`);
      ns.print(`Greed: ${ns.formatPercent(metrics.greed)}`);
      ns.print(`Batches: ${metrics.depth}`);
      ns.print(`ETA ${ns.tFormat(metrics.end - Date.now())}`);
    }, 1000);
    ns.atExit(() => clearInterval(timer));

    while (jobs.size > 0) {
      await dataPort.nextWrite();
      dataPort.clear();

      const oldJob = jobs.popFront() as Job;
      ramNet.finish(oldJob);
    }

    clearInterval(timer);
  }
}

async function optimizeShotgun(ns: NS, metrics: Metrics, ramNet: RamNet): Promise<void> {
  const maxThreads = ramNet.maxBlockSize() / 1.75;
  const maxMoney = metrics.maxMoney;
  const hPercent = ns.hackAnalyze(metrics.target);
  const wTime = ns.getWeakenTime(metrics.target);

  const minGreed = 0.001;
  const stepValue = 0.01;
  let greed = 0.99;
  let best = 0;

  while (greed > minGreed) {
    const amount = maxMoney * greed;
    const hThreads = Math.max(Math.floor(ns.hackAnalyzeThreads(metrics.target, amount)), 1);
    const tGreed = hThreads * hPercent;
    const gThreads = Math.ceil(ns.growthAnalyze(metrics.target, maxMoney / (maxMoney - maxMoney * tGreed)) * 1.01);

    // Only continue if we have the space for it
    if (Math.max(hThreads, gThreads) <= maxThreads) {
      const wThreads1 = Math.max(Math.ceil((hThreads * 0.002) / 0.05), 1);
      const wThreads2 = Math.max(Math.ceil((gThreads * 0.004) / 0.05), 1);

      const threadCosts = [hThreads * 1.7, wThreads1 * 1.75, gThreads * 1.75, wThreads2 * 1.75];

      const batchCount = ramNet.simulate(threadCosts);
      const income = (tGreed * maxMoney * batchCount) / (metrics.spacer * 4 * batchCount + wTime);
      if (income > best) {
        best = income;
        metrics.greed = tGreed;
        metrics.depth = batchCount;
      }
    }
    await ns.sleep(0);
    greed -= stepValue;
  }
  if (best === 0) {
    throw new Error(`Not enough RAM to run a single batch.`);
  }
}
