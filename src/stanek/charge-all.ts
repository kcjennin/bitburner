import { ServerPool } from '@/hacking/lib/ServerPool';
import { ActiveFragment, NS } from '@ns';

export const CHARGE_SCRIPT = '/scripts/workers/charge.js';
export const CHARGE_RAM = 2;

function getWorstFragment(ns: NS): ActiveFragment | undefined {
  const fragments = ns.stanek.activeFragments().filter((f) => (f as unknown as { limit: number }).limit != 99);
  return fragments.sort((a, b) => a.highestCharge - b.highestCharge || a.numCharge - b.numCharge).at(0);
}

function deployCharges(ns: NS, x: number, y: number, useHacknet: boolean): number {
  const servers = new ServerPool(ns, useHacknet).getServers();
  let running = 0;
  servers.forEach((s) => {
    const threads = Math.floor((s.ram - s.reserved) / CHARGE_RAM);
    if (threads > 0) {
      const jobPid = ns.exec(CHARGE_SCRIPT, s.name, { threads, temporary: true }, x, y, ns.pid);
      if (jobPid === 0) throw `Failed to submit job: ${s.name} ${threads} ${x},${y}`;
      running++;
    }
  });
  return running;
}

export async function main(ns: NS): Promise<void> {
  const { useHacknet } = ns.flags([['useHacknet', false]]) as { useHacknet: boolean };
  const dataPort = ns.getPortHandle(ns.pid);

  while (true) {
    const fragment = getWorstFragment(ns);
    if (!fragment) {
      ns.tprint(`Can't get a worst fragment.`);
      ns.exit();
    }

    let running = deployCharges(ns, fragment.x, fragment.y, useHacknet);
    if (running === 0) throw "Can't deploy any jobs.";

    while (running > 0) {
      if (dataPort.empty()) await dataPort.nextWrite();
      dataPort.read();
      running--;
    }
  }
}
