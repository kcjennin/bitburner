import { AutocompleteData, NS } from '@ns';
import { PORT_MAP } from '@/lib/port-map';

const SCRIPT_RAM = 1.75;

async function getThreadsGW(ns: NS, target: string, totalThreads: number): Promise<[number, number]> {
  ns.clearPort(PORT_MAP.hwgwPort);
  ns.exec('/hacking/gw-analyze.js', target, 1, totalThreads, PORT_MAP.hwgwPort);

  let count = 1000;
  while (count > 0) {
    const result = ns.readPort(PORT_MAP.hwgwPort);
    if (result !== 'NULL PORT_MAP.hwgwPort DATA') return result;
    --count;
    await ns.sleep(20);
  }

  return [0, 0];
}

async function getThreadsHWGW(ns: NS, target: string, totalThreads: number): Promise<[number, number, number, number]> {
  ns.enableLog('ALL');
  ns.clearPort(PORT_MAP.hwgwPort);
  ns.exec('/hacking/hwgw-analyze.js', target, 1, totalThreads, PORT_MAP.hwgwPort);

  let count = 100,
    result;
  while (count > 0) {
    result = ns.readPort(PORT_MAP.hwgwPort);
    if (result !== 'NULL PORT_MAP.hwgwPort DATA') break;
    --count;
    await ns.sleep(20);
  }

  ns.disableLog('ALL');

  if (result === 'NULL PORT_MAP.hwgwPort DATA' || result === 'NO SOLUTION') {
    return [0, 0, 0, 0];
  } else {
    return result;
  }
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

      ns.print(g, ' ', w);
      ns.run('/hacking/primitives/grow.js', g, target, JSON.stringify({ additionalMsec: wTime - gTime - 100 }));
      ns.run('/hacking/primitives/weak.js', w, target);
      await ns.sleep(Math.max(wTime + 1000, 20));
    }

    ns.scp('/hacking/hwgw-analyze.js', target);
    while (!securityNotOK(ns, target) && !moneyNotOK(ns, target)) {
      ns.print('Hacking');

      const hTime = ns.getHackTime(target),
        gTime = ns.getGrowTime(target),
        wTime = ns.getWeakenTime(target);

      let batchThreads = totalThreads;
      const [h, w1, g, w2] = await getThreadsHWGW(ns, target, totalThreads);

      if (h === 0) {
        ns.print('getThreadsHWGW() failed.');
        ns.exit();
      }

      const hwgw = h + w1 + g + w2;
      while (batchThreads - hwgw > 0) {
        ns.run('/hacking/primitives/hack.js', h, target, JSON.stringify({ additionalMsec: wTime - hTime - 200 }));
        ns.run('/hacking/primitives/weak.js', w1, target, JSON.stringify({ additionalMsec: 0 }));
        ns.run(
          '/hacking/primitives/grow.js',
          g,
          target,
          JSON.stringify({ additionalMsec: wTime - gTime - 200 + 1000 }),
        );
        ns.run('/hacking/primitives/weak.js', w2, target, JSON.stringify({ additionalMsec: 1000 }));

        batchThreads -= hwgw;
        await ns.sleep(100);
      }

      await ns.sleep(Math.max(wTime + 2000, 20));
    }

    await ns.sleep(100);
  }
}
