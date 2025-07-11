import { connectPath, tryRun } from '@/lib/utils';
import { NS, Player } from '@ns';
// import * as augmentData from '@/singularity/hacking-augments.json';

const PERIOD = 10000;
const CRAWLER = {
  script: '/hacking/crawler.js',
  ram: 2.35,
};
const BATCHER = {
  script: '/hacking/batcher/batcher.js',
  ram: 12.15,
};
const BUY_SERVER = {
  script: '/scripts/buy-server.js',
  ram: 5.7,
};
const FACTIONS = ['CyberSec', 'Tian Di Hui', 'NiteSec', 'The Black Hand', 'BitRunners'];
const PROGRAMS = ['BruteSSH.exe', 'FTPCrack.exe', 'relaySMTP.exe', 'HTTPWorm.exe', 'SQLInject.exe'];
const RAM_MAX = 1048576;
const FINAL_MONEY = 1e11;

async function backdoor(ns: NS, target: string): Promise<void> {
  if (!ns.hasRootAccess(target)) return;
  const path = connectPath(ns, 'home', target);
  const safeConnect = (node: string) => {
    if (!ns.singularity.connect(node)) {
      throw new Error(`Failed to connect to ${node} from ${ns.getHostname()}`);
    }
  };

  path.forEach(safeConnect);
  await ns.singularity.installBackdoor();

  // Go back
  ns.singularity.connect('home');
}

function factionWork(ns: NS, player: Player, action: string) {
  const repLimit = 475000;
  const purchasedAugments = ns.singularity.getOwnedAugmentations(true);
  const joinedFactions = FACTIONS.filter((faction) => player.factions.includes(faction));
  let currentRep = 0;
  let targetRep = 0;

  for (const faction of joinedFactions) {
    const factionAugments = ns.singularity
      .getAugmentationsFromFaction(faction)
      .filter((aug) => !purchasedAugments.includes(aug));
    if (factionAugments.length === 0) continue;
    // Only need 2 augments from TDH
    if (faction === 'Tian Di Hui' && factionAugments.length <= 6) continue;

    targetRep = Math.min(
      repLimit,
      factionAugments.reduce((max, aug) => Math.max(max, ns.singularity.getAugmentationRepReq(aug)), 0),
    );

    // Don't need everything from TDH, just the reputation stuff
    if (faction === 'Tian Di Hui') {
      targetRep = ns.singularity.getAugmentationRepReq('Social Negotiation Assistant (S.N.A)');
    }

    // Work until we hit our goal
    const rep = ns.singularity.getFactionRep(faction);
    if (rep < targetRep) {
      if (action !== faction) {
        ns.singularity.workForFaction(faction, 'hacking', true);
        action = faction;
      }
      currentRep = rep;
      break;
    }
  }

  if (
    (action === FACTIONS[FACTIONS.length - 1] && ns.singularity.getFactionRep(action) > repLimit) ||
    (action === 'start' && joinedFactions.length > 0)
  ) {
    action = 'end';
  }

  return {
    action,
    numFactions: joinedFactions.length,
    numAugments: purchasedAugments.length,
    currentRep,
    targetRep,
  };
}

function buyServers(ns: NS): number {
  const startRam = 256;
  const servers = ns.getPurchasedServers();
  const allServers = servers.length === ns.getPurchasedServerLimit();
  const running = ns.scriptRunning(BUY_SERVER.script, 'home');

  if (!allServers && !running) {
    // haven't run yet
    tryRun(ns, BUY_SERVER.script, '-a', startRam);
    return 256;
  } else if (allServers && !running) {
    // have run previously, double it
    const ram = 2 * ns.getServerMaxRam('pserv-0');
    if (ram > RAM_MAX) return RAM_MAX;
    tryRun(ns, BUY_SERVER.script, '-a', ram);
    return ram;
  } else if (servers.length > 0) {
    // running, some progress
    if (servers.map(ns.getServerMaxRam).every((ram, _, arr) => ram === arr[0])) {
      // if they're all the same it hasn't upgraded a single one yet, so the target
      // is twice the first server's ram
      return 2 * ns.getServerMaxRam('pserv-0');
    } else {
      // if some are different it should just be the first server's ram
      return ns.getServerMaxRam('pserv-0');
    }
  } else {
    // nothing purchased but it's running, must be the first run
    return startRam;
  }
}

export async function main(ns: NS): Promise<void> {
  ns.disableLog('ALL');
  ns.ui.openTail();

  if (typeof ns.args[0] !== 'number') return;
  const port = ns.args[0];
  let action = 'start';

  let previousRep = 0;
  let runBatch = true;
  while (true) {
    const player = ns.getPlayer();

    // always try to upgrade RAM
    ns.singularity.upgradeHomeRam();
    // try and buy a tor router
    if (player.money > 200000) ns.singularity.purchaseTor();
    const programs = PROGRAMS.filter((program) => ns.fileExists(program) || ns.singularity.purchaseProgram(program));

    // Always run crawl
    tryRun(ns, CRAWLER.script);
    // Also try and run batcher, for money and stuff
    if (runBatch) tryRun(ns, BATCHER.script);
    // If we bought all the programs buy servers
    const serverRam = programs.length === PROGRAMS.length ? buyServers(ns) : 0;

    // Once the servers are setup try and buy Formulas
    if (serverRam > 1024) {
      if (!ns.fileExists('Formulas.exe')) ns.singularity.purchaseProgram('Formulas.exe');
      tryRun(ns, '/ipvgo/ipvgo.js');
    }

    // Once the servers are maxed and we have some money switch to sharing
    if (serverRam === RAM_MAX && player.money > FINAL_MONEY) {
      ns.scriptKill(BATCHER.script, 'home');
      runBatch = false;
      tryRun(ns, '/scripts/share-all.js');
    }

    if (!player.factions.includes('CyberSec')) {
      // Try and join factions
      await backdoor(ns, 'CSEC');
    } else if (!player.factions.includes('Tian Di Hui') && player.city !== 'Chongqing') {
      ns.singularity.travelToCity('Chongqing');
    } else if (
      !player.factions.includes('NiteSec') &&
      player.skills.hacking >= ns.getServerRequiredHackingLevel('avmnite-02h')
    ) {
      await backdoor(ns, 'avmnite-02h');
    } else if (
      !player.factions.includes('The Black Hand') &&
      player.skills.hacking >= ns.getServerRequiredHackingLevel('I.I.I.I')
    ) {
      await backdoor(ns, 'I.I.I.I');
    } else if (
      !player.factions.includes('BitRunners') &&
      player.skills.hacking >= ns.getServerRequiredHackingLevel('run4theh111z')
    ) {
      await backdoor(ns, 'run4theh111z');
    }

    ns.singularity.checkFactionInvitations().forEach((faction) => ns.singularity.joinFaction(faction));

    const work = factionWork(ns, player, action);
    ({ action } = work);
    const { numFactions, numAugments, currentRep, targetRep } = work;
    // rate in reputation/ms
    const rate = (currentRep - previousRep) / PERIOD;
    const eta = (targetRep - currentRep) / (rate + 1e-7);

    if (action === 'end' && numFactions >= FACTIONS.length && programs.length >= 5 && serverRam === RAM_MAX) {
      // at the end, stop sharing and just build money. Which is rep now.
      ns.scriptKill('/scripts/share-all.js', 'home');
      await ns.sleep(10000);
      tryRun(ns, BATCHER.script);
      break;
    }

    ns.clearLog();
    ns.print(`Home RAM:           ${ns.formatRam(ns.getServerMaxRam('home'))}`);
    ns.print(`Number of programs: ${programs.length}/5`);
    ns.print(`Number of factions: ${numFactions}/${FACTIONS.length}`);
    ns.print(`Total Augments:     ${numAugments}`);
    ns.print(`Server RAM:         ${ns.formatRam(serverRam)}`);
    ns.print(`Current Work:       ${action}`);
    ns.print(`ETA (aprox.):       ${ns.tFormat(eta, false)}`);
    ns.print(`Rate:               ${ns.formatNumber(rate * 1000)}rep/s`);
    ns.print(`Remaining:          ${ns.formatNumber(targetRep - currentRep, 0)}rep`);
    await ns.sleep(PERIOD);

    previousRep = currentRep;
  }

  ns.writePort(port, 'exit');
}
