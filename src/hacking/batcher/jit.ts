import { NS } from '@ns';
import { getServers } from '@/lib/utils';
import { Target } from '@/hacking/lib/Target';
import { Expediter } from '@/hacking/lib/Expediter';
import { JITScheduler } from '@/hacking/batcher/JITScheduler';
import { JOB_TYPES, Job, copyScripts } from '@/hacking/lib/Job';

export async function main(ns: NS): Promise<void> {
  ns.disableLog('ALL');
  ns.ui.openTail();
  ns.clearPort(ns.pid);
  ns.clearLog();

  let target: Target = { target: '' } as unknown as Target;

  const ram = new Expediter(ns);
  const scheduler = new JITScheduler(ns);
  let tn = ns.args.at(0) as string | undefined;
  if (tn === undefined) {
    tn = chooseTarget(ns);
    if (tn === undefined) throw 'Failed to find a target.';
  }
  target = Target.best(ns, ram, tn, true, 5);
  if (!isPrepped(ns, target.name)) {
    await prep(ns, ram, target.name);
    target.update(ram, scheduler.size());
    // sometimes it doesn't clear the RAM fast enough
    await ns.sleep(500);
  }

  let cycles = 0;
  let desyncs = 0;
  const timer = setInterval(() => {
    ns.clearLog();
    ns.print(
      `Target:    ${target.name} (${ns.formatNumber(cycles, 3, 1000, true)}) (${ns.formatNumber(
        desyncs,
        3,
        1000,
        true,
      )})`,
    );
    ns.print(`Scheduled: ${scheduler.size()}/${target.actualMaxBatches}`);
    ns.print(`Completed: ${Math.floor(scheduler.stopped / 4)}`);
    ns.print(`Greed:     ${ns.formatPercent(target.greed, 1)} ($${ns.formatNumber(target.batchMoney)})`);
    ns.print(`Weaken:    ${ns.tFormat(target.times.weaken1)}`);
    ns.print(`${new Date().toLocaleTimeString()}`);
  }, 1000);
  ns.atExit(() => clearInterval(timer));

  let needsResync = false;
  while (true) {
    // make sure all servers have the executable scripts
    getServers(ns)
      .filter((s) => ns.getServer(s).hasAdminRights)
      .forEach((s) => copyScripts(ns, s));

    // update metrics
    target.update(ram, scheduler.size());
    ram.update();

    if (target.maxBatches === 0 && scheduler.size() === 0) throw 'No batches to run.';
    for (let _ = 0; _ < target.maxBatches; ++_) {
      for (const type of JOB_TYPES) {
        const job = new Job(type, target);
        const server = ram.reserve(job.cost());
        if (server === undefined) throw 'Failed to reserve RAM for job.';
        job.server = server;
        scheduler.push(job);
      }
    }

    needsResync = needsResync || (await scheduler.deploy(target, ram));
    if (needsResync) {
      needsResync = !scheduler.resync();
      desyncs++;
    }

    cycles++;
  }
}

export function isPrepped(ns: NS, server: string): boolean {
  const so = ns.getServer(server);
  return (so.hackDifficulty ?? 0) === (so.minDifficulty ?? 0) && (so.moneyAvailable ?? 0) === (so.moneyMax ?? 0);
}

export async function prep(ns: NS, ram: Expediter, target: string) {
  const dataPort = ns.getPortHandle(ns.pid);

  while (!isPrepped(ns, target)) {
    getServers(ns)
      .filter((s) => ns.getServer(s).hasAdminRights)
      .forEach((s) => copyScripts(ns, s));
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

    const neededThreads = w1Threads + gThreads + w2Threads;

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
        JSON.stringify({ type: 'prep', target, report: true, threads, server }),
      );
      if (pid === 0) {
        ns.print(`ERROR: Failed to submit prep job.`);
        ns.print(`ERROR:   ${script}`);
        ns.print(`ERROR:   ${server}`);
        ns.print(`ERROR:   ${{ threads, temporary: true }}`);
        ns.print(`ERROR:   ${ns.pid}`);
        ns.print(`ERROR:   ${{ target, end, time, report: true }}`);
        throw 'Failed to submit job.';
      }
      const port = ns.getPortHandle(pid);
      await port.nextWrite();
      port.clear();

      jobs++;
      return threads;
    };

    while (w1Threads > 0 && ram.largest >= 1.75) {
      w1Threads -= await startJob(w1Threads, '/hacking/workers/tWeaken.js');
    }

    while (gThreads > 0 && ram.largest >= 1.75) {
      gThreads -= await startJob(gThreads, '/hacking/workers/tGrow.js', Date.now() + wTime + 5, gTime);
    }

    while (w2Threads > 0 && ram.largest >= 1.75) {
      w2Threads -= await startJob(w2Threads, '/hacking/workers/tWeaken.js', Date.now() + wTime + 10, wTime);
    }

    const deployedThreads = neededThreads - (w1Threads + gThreads + w2Threads);
    const batches = Math.max(Math.ceil(neededThreads / deployedThreads), 1);
    const endTime = Date.now() + wTime * batches;

    const timer = setInterval(() => {
      ns.clearLog();
      ns.print(`Target:    ${target}`);
      ns.print(`Security: +${ns.formatNumber(security - (so.minDifficulty ?? 0), 2)}`);
      ns.print(`Money:     ${ns.formatNumber(so.moneyAvailable ?? 0)}/${ns.formatNumber(so.moneyMax ?? 0)}`);
      ns.print(`Batches:   ${batches}`);
      ns.print(`Batch ETA: ${ns.tFormat(endTime - Date.now())}`);
    }, 1000);
    ns.atExit(() => clearInterval(timer));

    while (jobs > 0) {
      if (dataPort.empty()) await dataPort.nextWrite();
      const { server, cost } = JSON.parse(dataPort.read());
      ram.free(cost, server);
      jobs--;
    }

    clearInterval(timer);
    await ns.sleep(0);
  }
  ns.clearLog();
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

function chooseTarget(ns: NS): string | undefined {
  // get all the servers that are eligible for hacking and sort by a naive weight
  const servers = getServers(ns)
    .filter((s) => ns.getServer(s).hasAdminRights && serverWeight(ns, s) > 0)
    .sort((a, b) => serverWeight(ns, b) - serverWeight(ns, a));

  const ram = new Expediter(ns);
  // check the actual rate of the top ten (at most) and get the best of those
  return servers
    .slice(0, Math.min(10, servers.length))
    .map((s) => {
      try {
        return [s, Target.best(ns, ram, s, false).moneyRate] as [string, number];
      } catch {
        return [s, 0] as [string, number];
      }
    })
    .filter(([, sR]) => sR > 0)
    .sort(([, aR], [, bR]) => bR - aR)
    .at(0)?.[0];
}
