import { ActiveFragment, NS } from '@ns';
import { getServers } from '@/lib/utils';
import { CHARGE_RAM, CHARGE_SCRIPT } from '@/stanek/charge-all';
import { dodge } from '@/lib/dodge';

export async function main(ns: NS): Promise<void> {
  const biggest = getServers(ns)
    .map((s) => ({
      hostname: s,
      hasAdminRights: ns.hasRootAccess(s),
      ramAvailable: ns.getServerMaxRam(s) - ns.getServerUsedRam(s),
    }))
    .filter((s) => s.hasAdminRights)
    .reduce((mS, s) => (s.ramAvailable > mS.ramAvailable ? s : mS));
  const threads = Math.floor(biggest.ramAvailable / CHARGE_RAM);

  if (threads <= 0) throw 'No server available to run the charge.';
  ns.tprint(`Updating with ${threads} (${threads * CHARGE_RAM} / ${biggest.ramAvailable}) threads.`);

  const fragments = ((await dodge({ ns, command: 'ns.stanek.activeFragments()' })) as ActiveFragment[]).filter(
    (f) => (f as unknown as { limit: number }).limit != 99,
  );
  for (const f of fragments) {
    const jobPid = ns.exec(CHARGE_SCRIPT, biggest.hostname, { threads, temporary: true }, f.x, f.y);
    if (jobPid === 0) throw `Failed to submit job: ${biggest.hostname} ${threads} ${f.x},${f.y}`;

    while (ns.isRunning(jobPid)) await ns.sleep(10);
  }
}
