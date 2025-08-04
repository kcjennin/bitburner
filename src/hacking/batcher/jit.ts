import { NS } from '@ns';
import { getServers, isPrepped } from '@/lib/utils';
import { Target } from '@/hacking/lib/Target';
import { Expediter } from '@/hacking/lib/Expediter';
import { JITScheduler } from '@/hacking/batcher/JITScheduler';
import { JOB_TYPES, Job, copyScripts } from '@/hacking/lib/Job';
import { chooseTarget, prep } from '@/hacking/lib/util';

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
  target = Target.best(ns, ram, tn, true, 30);
  if (!isPrepped(ns, target.name)) {
    await prep(ns, ram, target.name);
    // sometimes it doesn't clear the RAM fast enough
    await ns.sleep(500);
    target.update(ram, scheduler.size());
  }

  let cycles = 0;
  let desyncs = 0;
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
  }
}
