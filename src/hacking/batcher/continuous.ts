import { isPrepped } from '@/lib/utils';
import { NS } from '@ns';
import { Expediter } from '@/hacking/lib/Expediter';
import { Target } from '@/hacking/lib/Target';
import { chooseTarget, prep } from '@/hacking/lib/util';
import { ContinuousScheduler } from './ContinuousScheduler';

export async function main(ns: NS): Promise<void> {
  ns.disableLog('ALL');
  ns.ui.openTail();
  ns.clearPort(ns.pid);
  ns.clearLog();

  let target: Target = { target: '' } as unknown as Target;

  const ram = new Expediter(ns);
  const scheduler = new ContinuousScheduler(ns);
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

  const cycles = 0;
  const desyncs = 0;
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
}
