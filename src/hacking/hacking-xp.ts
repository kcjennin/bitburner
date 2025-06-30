import { Job } from '@/lib/Job';
import { Metrics } from '@/lib/Metrics';
import { RamNet } from '@/lib/RamNet';
import { copyScripts, getServers, SCRIPTS } from '@/lib/utils';
import { NS } from '@ns';

const WORKERS = ['/lib/workers/tGrow.ts', '/lib/workers/tWeaken.ts'];
const JOB_TYPES = ['grow', 'weaken2'] as const;

export async function main(ns: NS): Promise<void> {
  ns.disableLog('ALL');
  ns.ui.openTail();

  const target = (ns.args[0] ?? 'joesguns').toString();
  const dataPort = ns.getPortHandle(ns.pid);
  dataPort.clear();

  while (true) {
    const servers = getServers(ns, (server) => {
      copyScripts(ns, server, WORKERS, true);
      return ns.hasRootAccess(server);
    });
    const ramNet = new RamNet(ns, servers);
    const metrics = new Metrics(ns, target);

    ns.print('Optimizing...');
    await optimizeShotgunGW(ns, metrics, ramNet);
    metrics.calculateGW(ns);

    metrics.end = Date.now() + metrics.wTime + metrics.spacer;

    let batchCount = 0;
    const jobs: Job[] = [];
    while (batchCount++ < metrics.depth) {
      for (const type of JOB_TYPES) {
        metrics.end += metrics.spacer;

        const job = new Job(type, metrics, batchCount);
        if (!ramNet.assign(job) || job.threads === 0) {
          ns.print(`ERROR: Unable to assign ${job.type}. Dumping debug info.`);
          ns.print(job);
          ns.print(metrics);
          // ramNet.printBlocks(ns);
          return;
        }
        jobs.push(job);
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

    const timer = setInterval(() => {
      ns.clearLog();
      ns.print(`Batches: ${jobs.length}`);
      ns.print(`ETA ${ns.tFormat(metrics.end - Date.now())}`);
    }, 1000);
    ns.atExit(() => clearInterval(timer));

    jobs.reverse();

    while (jobs.length > 0) {
      await dataPort.nextWrite();
      dataPort.clear();

      ramNet.finish(jobs.pop());
    }

    clearInterval(timer);
  }
}

async function optimizeShotgunGW(ns: NS, metrics: Metrics, ramNet: RamNet): Promise<void> {
  const maxThreads = ramNet.maxBlockSize() / 1.75;
  let gThreads = Math.max(Math.floor((25 * maxThreads) / 27), 1);
  let batchCount = 0;
  const bestBatch = { gThreads: 0, wThreads: 0, depth: 0 };
  const stepValue = Math.max(Math.round(maxThreads * 0.05), 1);

  while (gThreads > 1) {
    const wThreads = Math.max(Math.ceil((gThreads * 0.004) / 0.05), 1);
    batchCount = ramNet.simulate([gThreads * 1.75, wThreads * 1.75]);
    if (batchCount * gThreads > bestBatch.depth * bestBatch.gThreads) {
      bestBatch.gThreads = gThreads;
      bestBatch.wThreads = wThreads;
      bestBatch.depth = batchCount;
    }
    gThreads -= stepValue;
    await ns.sleep(0);
  }

  if (bestBatch.depth > 0) {
    metrics.depth = bestBatch.depth;
    metrics.threads['grow'] = bestBatch.gThreads;
    metrics.threads['weaken2'] = bestBatch.wThreads;
  } else {
    throw new Error('Failed to find a suitable ShotgunGW batch.');
  }
}
