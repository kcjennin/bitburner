import { AutocompleteData, NS } from '@ns';
import { PORT_MAP } from '@/lib/port-map';

const SCRIPT_RAM = 1.75;

async function getThreadsGW(ns: NS, target: string, totalThreads: number): Promise<[number, number]> {
  ns.clearPort(PORT_MAP.hwgwPoorPort);
  ns.exec('/hacking/gw-analyze.js', target, 1, totalThreads, PORT_MAP.hwgwPoorPort);

  let count = 1000;
  while (count > 0) {
    const result = ns.readPort(PORT_MAP.hwgwPoorPort);
    if (result !== 'NULL PORT DATA') return result;
    --count;
    await ns.sleep(20);
  }

  return [0, 0];
}

async function getThreadsHW(ns: NS, target: string, totalThreads: number): Promise<[number, number]> {
  ns.clearPort(PORT_MAP.hwgwPoorPort);
  ns.exec('/hacking/hw-analyze.js', target, 1, totalThreads, PORT_MAP.hwgwPoorPort);

  let count = 1000;
  while (count > 0) {
    const result = ns.readPort(PORT_MAP.hwgwPoorPort);
    if (result !== 'NULL PORT DATA') return result;
    --count;
    await ns.sleep(20);
  }

  return [0, 0];
}

function securityNotOK(ns: NS, target: string) {
  return ns.getServerSecurityLevel(target) > ns.getServerMinSecurityLevel(target);
}

function moneyNotOK(ns: NS, target: string) {
  return ns.getServerMoneyAvailable(target) < ns.getServerMaxMoney(target);
}

export function autocomplete(data: AutocompleteData) {
  return data.servers;
}

export async function main(ns: NS): Promise<void> {
  ns.disableLog('ALL');
  if (ns.args.length !== 1) return;
  const target = String(ns.args[0]);
  const hostname = ns.getHostname();

  while (true) {
    const totalRam = ns.getServerMaxRam(hostname) - ns.getServerUsedRam(hostname);
    if (totalRam <= SCRIPT_RAM * 3) {
      ns.print(`Not enough RAM: ${totalRam}`);
      return;
    }

    const totalThreads = Math.floor(totalRam / SCRIPT_RAM);

    while (securityNotOK(ns, target)) {
      ns.print('Weakening');
      ns.run('/hacking/primitives/weak.js', totalThreads, target);
      await ns.sleep(Math.max(ns.getWeakenTime(target) + 200, 20));
    }

    ns.scp('/hacking/gw-analyze.js', target);
    while (moneyNotOK(ns, target)) {
      ns.print('Growing');
      const [g, w] = await getThreadsGW(ns, target, totalThreads);
      const gTime = ns.getGrowTime(target),
        wTime = ns.getWeakenTime(target);

      if (g === 0) {
        ns.print('getThreadsGW() failed.');
        ns.exit();
      }

      ns.run('/hacking/primitives/grow.js', g, target, JSON.stringify({ additionalMsec: wTime - gTime - 100 }));
      ns.run('/hacking/primitives/weak.js', w, target);
      await ns.sleep(wTime + 200);
    }

    ns.scp('/hacking/hw-analyze.js', target);
    while (!securityNotOK(ns, target) && !moneyNotOK(ns, target)) {
      ns.print('Hacking');

      const hTime = ns.getHackTime(target),
        gTime = ns.getGrowTime(target),
        wTime = ns.getWeakenTime(target);

      const [h, w1] = await getThreadsHW(ns, target, totalThreads);
      if (h === 0) {
        ns.print('getThreadsHW() failed.');
        ns.exit();
      }
      ns.run('/hacking/primitives/hack.js', h, target, JSON.stringify({ additionalMsec: wTime - hTime - 100 }));
      ns.run('/hacking/primitives/weak.js', w1, target, JSON.stringify({ additionalMsec: 0 }));
      await ns.sleep(wTime + 200);

      const [g, w2] = await getThreadsGW(ns, target, totalThreads);
      if (g === 0) {
        ns.print('getThreadsGW() failed.');
        ns.exit();
      }
      ns.run('/hacking/primitives/grow.js', g, target, JSON.stringify({ additionalMsec: wTime - gTime - 100 }));
      ns.run('/hacking/primitives/weak.js', w2, target);
      await ns.sleep(wTime + 200);
    }
    await ns.sleep(100);
  }
}
