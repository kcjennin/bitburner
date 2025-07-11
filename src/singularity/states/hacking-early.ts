import { NS } from '@ns';

export async function main(ns: NS): Promise<void> {
  if (typeof ns.args[0] !== 'number') return;
  const port = ns.args[0];
  const minHacking = ns.getServerRequiredHackingLevel('CSEC');
  let started = false;

  while (true) {
    const {
      skills: { hacking },
    } = ns.getPlayer();

    if (!started) {
      started = ns.singularity.universityCourse('Rothman University', 'Algorithms', true);
    }

    if (hacking >= minHacking) break;
    await ns.sleep(1000);
  }

  ns.print('Stopped');
  ns.singularity.stopAction();

  // If this is the first go-around, crime is better for initial money
  if (ns.getServerMaxRam('home') === 32) {
    ns.print('Switching to Crime');
    ns.writePort(port, 'crime-early');
  } else {
    ns.print('Switching to Mid');
    ns.writePort(port, 'hacking-mid');
  }

  ns.print('Done.');
}
