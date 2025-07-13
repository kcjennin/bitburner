import { NS } from '@ns';
import { Target } from '@/hacking/jit/Target';
import { Expediter } from '@/hacking/jit/Expediter';
import { Scheduler } from './Scheduler';
import { JOB_TYPES, Job, copyScripts } from './Job';
import { getServers } from '@/lib/utils';

export async function main(ns: NS): Promise<void> {
  ns.disableLog('ALL');
  ns.ui.openTail();

  getServers(ns)
    .filter((s) => ns.getServer(s).hasAdminRights)
    .forEach((s) => copyScripts(ns, s));
  const target = new Target(ns, 'harakiri-sushi', 5, 0.05).update();
  const ram = new Expediter(ns);
  const scheduler = new Scheduler(ns);

  if (!isPrepped(ns, target.name)) await prep(ns, target.name);

  for (let _ = 0; _ < target.maxBatches; ++_) {
    for (const type of JOB_TYPES) {
      const job = new Job(type, target);
      const server = ram.reserve(job.cost());
      if (server === undefined) throw 'Failed to reserve RAM for job.';
      job.server = server;
      scheduler.push(job);
    }
  }

  await scheduler.deploy(target);
  ns.print(`Deployed ${target.maxBatches - scheduler.size()} batches out of ${target.maxBatches}.`);
}

function isPrepped(ns: NS, server: string): boolean {
  const so = ns.getServer(server);
  return (so.hackDifficulty ?? 0) === (so.minDifficulty ?? 0) && (so.moneyAvailable ?? 0) === (so.moneyMax ?? 0);
}

async function prep(ns: NS, target: string) {
  const dataPort = ns.getPortHandle(ns.pid);

  while (!isPrepped(ns, target)) {
    const so = ns.getServer(target);
    const po = ns.getPlayer();

    const wTime = ns.formulas.hacking.weakenTime(so, po);
    const gTime = ns.formulas.hacking.growTime(so, po);
    const security = so.hackDifficulty ?? 0;

    let w1Threads = Math.ceil(((so.hackDifficulty ?? 0) - (so.minDifficulty ?? 0)) / 0.05);
    so.hackDifficulty = so.minDifficulty ?? 0;

    let gThreads = ns.formulas.hacking.growThreads(so, po, so.moneyMax ?? 0);
    let w2Threads = Math.ceil((gThreads * 0.004) / 0.05);

    const ram = new Expediter(ns);
    const totalBatches = Math.ceil(Math.floor(ram.total / 1.75) / (w1Threads + gThreads + w2Threads));
    const endTime = Date.now() + totalBatches * wTime;

    let jobs = 0;
    const startJob = async (tThreads: number, script: string, end = 0, time = 0) => {
      const threads = Math.min(tThreads, Math.floor(ram.largest / 1.75));

      const server = ram.reserve(threads * 1.75);
      if (server === undefined) throw 'Failed to reserve prep RAM.';

      const pid = ns.exec(script, server, threads, ns.pid, JSON.stringify({ target, end, time, report: true }));
      const port = ns.getPortHandle(pid);
      await port.nextWrite();
      port.clear();

      jobs++;
      return threads;
    };

    while (w1Threads > 0 && ram.largest >= 1.75) {
      w1Threads -= await startJob(w1Threads, '/lib/workers/tWeaken.js');
    }

    while (gThreads > 0 && ram.largest >= 1.75) {
      gThreads -= await startJob(gThreads, '/lib/workers/tGrow.js', Date.now() + wTime + 5, gTime);
    }

    while (w2Threads > 0 && ram.largest >= 1.75) {
      w2Threads -= await startJob(w2Threads, '/lib/workers/tWeaken.js', Date.now() + wTime + 10, wTime);
    }

    const timer = setInterval(() => {
      ns.clearLog();
      ns.print(`Security: +${ns.formatNumber(security - (so.minDifficulty ?? 0), 2)}`);
      ns.print(`Money:     ${ns.formatNumber(so.moneyAvailable ?? 0)}/${ns.formatNumber(so.moneyMax ?? 0)}`);
      ns.print(`Batch ETA: ${ns.tFormat(endTime - Date.now())}`);
    }, 1000);
    ns.atExit(() => clearInterval(timer));

    while (jobs-- > 0) {
      await dataPort.nextWrite();
      dataPort.clear();
    }

    clearInterval(timer);
    await ns.sleep(500);
  }
}
