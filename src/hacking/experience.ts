import { NS } from '@ns';
import { Expediter } from '@/hacking/lib/Expediter';
import { getServers } from '@/lib/utils';
import { copyScripts } from '@/hacking/lib/Job';
import { isPrepped, prep } from '@/hacking/batcher/jit';

export async function main(ns: NS): Promise<void> {
  ns.disableLog('ALL');
  const tn = ns.args[0] as string | undefined;
  if (tn === undefined) throw 'No target supplied.';
  const ram = new Expediter(ns);
  const dataPort = ns.getPortHandle(ns.pid);
  let fired = 0;

  if (!isPrepped(ns, tn)) await prep(ns, ram, tn);

  while (true) {
    // make sure all servers have the executable scripts
    getServers(ns)
      .filter((s) => ns.getServer(s).hasAdminRights)
      .forEach((s) => copyScripts(ns, s));
    ram.update();

    if (ram.largest < 1.75) throw 'Nowhere on the network to send jobs.';
    while (ram.largest >= 1.75) {
      const threads = Math.floor(ram.largest / 1.75);
      const server = ram.reserve(threads * 1.75) as string;
      const pid = ns.exec(
        '/hacking/workers/tGrow.js',
        server,
        threads,
        ns.pid,
        JSON.stringify({ type: 'exp', target: tn, report: true, threads, server }),
      );
      if (pid === 0) throw 'Failed to start job.';
      const port = ns.getPortHandle(pid);
      await port.nextWrite();
      port.read();
      fired++;
    }
    if (fired === 0) throw 'Failed to fire more jobs.';

    while (fired > 0) {
      if (dataPort.empty()) await dataPort.nextWrite();
      const { cost, server } = JSON.parse(dataPort.read());
      if (!ram.free(cost, server)) {
        throw `Failed to free ${ns.formatRam(cost)} from ${server}`;
      }

      fired--;
    }
    if (fired !== 0) throw `Failed to clear all jobs: ${fired}`;

    await ns.sleep(0);
  }
}
