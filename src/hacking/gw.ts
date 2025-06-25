import { AutocompleteData, NS } from '@ns';
import { PORT_MAP } from '@/lib/port-map';

const SCRIPT_RAM = 1.75;

async function getThreadsGW(ns: NS, target: string, totalThreads: number): Promise<[number, number]> {
  ns.clearPort(PORT_MAP.gwPort);
  ns.exec('/hacking/gw-analyze.js', target, 1, totalThreads, PORT_MAP.gwPort);

  let count = 1000;
  while (count > 0) {
    const result = ns.readPort(PORT_MAP.gwPort);
    if (result !== 'NULL PORT DATA') return result;
    --count;
    await ns.sleep(20);
  }

  return [0, 0];
}

export function autocomplete(data: AutocompleteData) {
  return data.servers;
}

/** @param {NS} ns */
export async function main(ns: NS): Promise<void> {
  ns.disableLog('ALL');
  let stock = false;

  if (ns.args.length === 2 && ns.args.includes('-s')) stock = true;
  else if (ns.args.length !== 1) {
    ns.tprint('usage: gw.js [-s] <target>');
    return;
  }

  const target = String(ns.args.filter((arg) => arg !== '-s')[0]);
  const totalRam = ns.getServerMaxRam(ns.getHostname()) - ns.getServerUsedRam(ns.getHostname());
  if (totalRam <= SCRIPT_RAM) {
    ns.print('ERROR: Not enough RAM.');
    return;
  }

  const totalThreads = Math.floor(totalRam / SCRIPT_RAM);

  // Weaken server to minimum security
  while (ns.getServerSecurityLevel(target) > ns.getServerMinSecurityLevel(target)) {
    ns.print('Weakening');
    ns.run('/hacking/primitives/weak.js', totalThreads, target);
    await ns.sleep(ns.getWeakenTime(target) + 200);
  }

  // Grow server to maximum money
  ns.scp('/hacking/gw-analyze.js', target);
  while (true) {
    ns.print('Growing');
    const [g, w] = await getThreadsGW(ns, target, totalThreads);
    const gTime = ns.getGrowTime(target),
      wTime = ns.getWeakenTime(target);

    if (g === 0) {
      ns.print('ERROR: getThreadsGW() failed.');
      ns.exit();
    }

    ns.run('/hacking/primitives/grow.js', g, target, JSON.stringify({ additionalMsec: wTime - gTime - 100, stock }));
    ns.run('/hacking/primitives/weak.js', w, target);
    await ns.sleep(wTime + 1000);
  }
}
