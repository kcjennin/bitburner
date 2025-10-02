import { NS } from '@ns';
import { parseFlags } from '../lib/cli';
import { copyWorkers } from '@/hacking/crawler';

const PREFIX = 'pserv-';
const DEFAULT_RAM = 32;

const flagSchema = [
  ['all', false],
  ['best', false],
  ['check', false],
  ['wait', false],
] as const;

export function autocomplete() {
  return flagSchema.map(([a]) => '--' + a);
}

function getBestAffordableRam(ns: NS, purchased: string[], maxServers: number, money: number): number {
  const maxRam = ns.getPurchasedServerMaxRam();
  let bestRam = 8;

  for (let ram = 8; ram <= maxRam; ram *= 2) {
    let totalCost = 0;
    for (let i = 0; i < maxServers; i++) {
      const name = `${PREFIX}${i}`;
      if (purchased.includes(name)) {
        const currentRam = ns.getServerMaxRam(name);
        if (currentRam < ram) totalCost += ns.getPurchasedServerUpgradeCost(name, ram);
      } else {
        totalCost += ns.getPurchasedServerCost(ram);
      }
    }
    if (totalCost <= money) bestRam = ram;
    else break;
  }

  return bestRam;
}

export async function main(ns: NS) {
  const { flags, usage } = parseFlags(ns, flagSchema);
  const ramArg = flags._[0] as number | undefined;

  if (flags.help) {
    ns.tprint('\n' + usage);
    ns.exit();
  }

  const purchased = ns.getPurchasedServers();
  const maxServers = ns.getPurchasedServerLimit();
  const toHost = (i: number) => `${PREFIX}${i}`;
  let targetRam: number;

  if (flags.best) {
    targetRam = getBestAffordableRam(ns, purchased, maxServers, ns.getServerMoneyAvailable('home'));
  } else if (ramArg !== undefined) {
    targetRam = ramArg;
  } else if (purchased.length === 0) {
    targetRam = DEFAULT_RAM;
  } else if (purchased.length === maxServers && new Set(purchased.map(ns.getServerMaxRam)).size === 1) {
    targetRam = ns.getServerMaxRam(purchased[0]) * 2;
  } else {
    targetRam = Math.max(...purchased.map(ns.getServerMaxRam));
  }

  let totalCost = 0;
  const terminalOutput: string[] = [];

  const ramString = (ram: number) => ns.formatRam(ram).padStart(8);
  const nameString = (name: string) => name.padEnd(8);

  const flushOutput = () => {
    if (terminalOutput.length) {
      ns.tprint('\n' + terminalOutput.join('\n'));
      terminalOutput.length = 0;
    }
  };

  const handleServer = async (i: number) => {
    const name = toHost(i);
    const exists = purchased.includes(name);
    let cost: number;
    let currentRam: number | undefined = undefined;

    if (exists) {
      currentRam = ns.getServerMaxRam(name);
      if (currentRam >= targetRam) return;
      cost = ns.getPurchasedServerUpgradeCost(name, targetRam);
    } else {
      cost = ns.getPurchasedServerCost(targetRam);
    }

    if (flags.check) {
      totalCost += cost;
      terminalOutput.push(
        `[CHECK] ${nameString(name)} ${currentRam ? ramString(currentRam) + ' -> ' : ''}${ramString(targetRam)}`,
      );
      return;
    }

    while (flags.wait && ns.getServerMoneyAvailable('home') < cost) {
      flushOutput();
      await ns.sleep(1000);
    }
    if (ns.getServerMoneyAvailable('home') < cost) return;

    if (exists) ns.upgradePurchasedServer(name, targetRam);
    else ns.purchaseServer(name, targetRam);

    terminalOutput.push(
      `${nameString(name)} ${currentRam ? ramString(currentRam) + ' -> ' : ''}${ramString(targetRam)}`,
    );
  };

  if (flags.all) {
    for (let i = 0; i < maxServers; i++) await handleServer(i);
  } else {
    const index =
      purchased.length < maxServers
        ? purchased.length
        : parseInt(
            purchased.reduce((a, b) => (ns.getServerMaxRam(a) <= ns.getServerMaxRam(b) ? a : b)).replace(PREFIX, ''),
          ) || 0;
    await handleServer(index);
  }

  if (flags.check) {
    totalCost > 0
      ? terminalOutput.push(`[CHECK] Total cost: $${ns.formatNumber(totalCost)}`)
      : terminalOutput.push(`[CHECK] Not enough money for an upgrade.`);
  }

  copyWorkers(ns, ns.getPurchasedServers());
  flushOutput();
}
