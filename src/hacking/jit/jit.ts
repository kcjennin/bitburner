import { NS } from '@ns';
import { Target } from '@/hacking/jit/Target';
import { Expediter } from '@/hacking/jit/Expediter';
import { Scheduler } from './Scheduler';
import { JOB_TYPES, Job, copyScripts } from './Job';
import { getServers } from '@/lib/utils';

export async function main(ns: NS): Promise<void> {
  ns.disableLog('ALL');
  ns.ui.openTail();
  ns.clearPort(ns.pid);

  const servers = getServers(ns)
    .filter((s) => ns.getServer(s).hasAdminRights)
    .sort((a, b) => serverWeight(ns, b) - serverWeight(ns, a));
  servers.forEach((s) => copyScripts(ns, s));
  const tn = servers[0];
  const target = new Target(ns, 'harakiri-sushi', 10, 0.05);
  const ram = new Expediter(ns);
  const scheduler = new Scheduler(ns);
  let cycleTime = 0;

  while (true) {
    const startTime = Date.now();
    target.update(ram, scheduler.size());
    ram.update();
    const so = ns.getServer(target.name);

    // If batches are running and money is less than expected from greed
    if (scheduler.size() > 0 && (so.moneyAvailable ?? 0) < (so.moneyMax ?? 0) * target.greed) {
      ns.print(`WARN: Desync occured.`);
      await scheduler.resync(ram, Date.now() + 2 * target.times['weaken2']);
      target.update(ram, scheduler.size());
    }
    if (scheduler.size() === 0 && !isPrepped(ns, target.name)) {
      ns.print('WARN: Not prepared:');
      ns.print(`WARN:     ${ns.formatNumber(so.hackDifficulty ?? 0)}/${ns.formatNumber(so.minDifficulty ?? 0)}`);
      ns.print(`WARN:     ${ns.formatNumber(so.moneyAvailable ?? 0)}/${ns.formatNumber(so.moneyMax ?? 0)}`);
      await prep(ns, target.name);
      target.update(ram, scheduler.size());
    }

    for (let _ = 0; _ < target.maxBatches; ++_) {
      for (const type of JOB_TYPES) {
        const job = new Job(type, target);
        const server = ram.reserve(job.cost());
        if (server === undefined) throw 'Failed to reserve RAM for job.';
        job.server = server;
        scheduler.push(job);
      }
    }

    cycleTime += Date.now() - startTime;
    cycleTime /= 2;
    await scheduler.deploy(target, ram);
    ns.clearLog();
    ns.print(`INFO: Scheduled: ${scheduler.size()}/${target.actualMaxBatches}`);
    ns.print(`INFO: Queued:    ${scheduler.queued()}`);
    ns.print(`INFO: Running:   ${scheduler.running}`);
    ns.print(`INFO: Started:   ${scheduler.started}`);
    ns.print(`INFO: Stopped:   ${scheduler.stopped}`);
    ns.print(`INFO: Cycle Time: ${ns.formatNumber(cycleTime)}`);
    ns.print(`INFO: ${new Date().toLocaleTimeString()}`);
    await ns.sleep(0);
  }
}

function isPrepped(ns: NS, server: string): boolean {
  const so = ns.getServer(server);
  return (so.hackDifficulty ?? 0) === (so.minDifficulty ?? 0) && (so.moneyAvailable ?? 0) === (so.moneyMax ?? 0);
}

async function prep(ns: NS, target: string) {
  const dataPort = ns.getPortHandle(ns.pid);
  const ram = new Expediter(ns);

  while (!isPrepped(ns, target)) {
    const so = ns.getServer(target);
    const po = ns.getPlayer();
    ram.update();

    const wTime = ns.formulas.hacking.weakenTime(so, po);
    const gTime = ns.formulas.hacking.growTime(so, po);
    const security = so.hackDifficulty ?? 0;

    let w1Threads = Math.ceil(((so.hackDifficulty ?? 0) - (so.minDifficulty ?? 0)) / 0.05);
    so.hackDifficulty = so.minDifficulty ?? 0;

    let gThreads = ns.formulas.hacking.growThreads(so, po, so.moneyMax ?? 0);
    let w2Threads = Math.ceil((gThreads * 0.004) / 0.05);

    const totalBatches = Math.ceil(Math.floor(ram.total / 1.75) / (w1Threads + gThreads + w2Threads));
    const endTime = Date.now() + totalBatches * wTime;

    let jobs = 0;
    const startJob = async (tThreads: number, script: string, end = 0, time = 0) => {
      const threads = Math.min(tThreads, Math.floor(ram.largest / 1.75));

      const server = ram.reserve(threads * 1.75);
      if (server === undefined) throw 'Failed to reserve prep RAM.';

      const pid = ns.exec(
        script,
        server,
        { threads, temporary: true },
        ns.pid,
        JSON.stringify({ target, end, time, report: true }),
      );
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
      if (dataPort.empty()) await dataPort.nextWrite();
      const { server, cost } = JSON.parse(dataPort.read());
      ram.free(cost, server);
    }

    clearInterval(timer);
    await ns.sleep(500);
  }
}

function serverWeight(ns: NS, server: string): number {
  const so = ns.getServer(server);
  const po = ns.getPlayer();
  const MIN_5 = 5 * 60 * 1000;

  so.hackDifficulty = so.minDifficulty ?? 0;

  if (ns.formulas.hacking.weakenTime(so, po) > MIN_5) return 0;
  if (po.skills.hacking < (so.requiredHackingSkill ?? 0)) return 0;

  return (so.moneyMax ?? 0) / ns.formulas.hacking.weakenTime(so, po);
}
