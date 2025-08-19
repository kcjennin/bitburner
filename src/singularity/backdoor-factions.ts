import { connectPath } from '@/lib/utils';
import { NS } from '@ns';

export async function main(ns: NS): Promise<void> {
  ns.singularity.connect('home');

  const {
    skills: { hacking },
    factions,
  } = ns.getPlayer();
  const hackingFactions = [
    { name: ns.enums.FactionName.CyberSec, server: 'CSEC' },
    { name: ns.enums.FactionName.NiteSec, server: 'avmnite-02h' },
    { name: ns.enums.FactionName.TheBlackHand, server: 'I.I.I.I' },
    { name: ns.enums.FactionName.BitRunners, server: 'run4theh111z' },
  ]
    .map((f) => ({ ...f, hackingLevel: ns.getServerRequiredHackingLevel(f.server) }))
    .filter((f) => !factions.includes(f.name) && hacking >= f.hackingLevel);

  for (const f of hackingFactions) {
    if (connectPath(ns, 'home', f.server).every((s) => ns.singularity.connect(s))) {
      await ns.singularity.installBackdoor();
      if (!ns.singularity.connect('home')) {
        throw `Failed to go back home after backdooring ${f.server}`;
      }
    } else {
      throw `Failed to connect to ${f.server}`;
    }
    if (ns.singularity.joinFaction(f.name)) {
      ns.toast(`Joined ${f.name}`);
    } else {
      throw `Failed to join faction: ${f.name}`;
    }
  }
}
