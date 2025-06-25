import { NS } from '@ns';

const SCRIPT_RAM = 1.75;

function securityNotOK(ns: NS, target: string) {
  return ns.getServerSecurityLevel(target) > ns.getServerMinSecurityLevel(target);
}

function moneyNotOK(ns: NS, target: string) {
  return ns.getServerMoneyAvailable(target) < ns.getServerMaxMoney(target);
}

export async function main(ns: NS): Promise<void> {
  const hostname = ns.getHostname();
  const target = ns.args.at(0) ?? ns.getHostname();
  const threads = Math.floor((ns.getServerMaxRam(hostname) - ns.getServerUsedRam(hostname)) / SCRIPT_RAM);
  const prepPort: number = JSON.parse(ns.read('/lib/port-map.json')).get('prepPort') ?? 1;

  if (threads <= 0) {
    ns.toast(`Not enough RAM to self-prep: ${hostname}`, 'warning');
    ns.tryWritePort(prepPort, hostname);
    return;
  }

  while (true) {
    const wTime = ns.getWeakenTime(hostname);
    const gTime = ns.getGrowTime(hostname);
    const hTime = ns.getHackTime(hostname);
    let sleepTime = 20;

    if (securityNotOK(ns, hostname)) {
      ns.run('/hacking/primitives/weak.js', threads, target);
      sleepTime += wTime;
    } else if (moneyNotOK(ns, hostname)) {
      ns.run('/hacking/primitives/grow.js', threads, target);
      sleepTime += gTime;
    } else {
      ns.run('/hacking/primitives/hack.js', threads, target);
      sleepTime += hTime;
    }

    await ns.sleep(sleepTime);
  }
}
