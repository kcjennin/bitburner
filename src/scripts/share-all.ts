import { copyScripts, getServers } from '@/lib/utils';
import { NS } from '@ns';

const WORKER = '/lib/workers/tShare.js';

export async function main(ns: NS): Promise<void> {
  const dataPort = ns.getPortHandle(ns.pid);
  dataPort.clear();

  while (true) {
    const servers = getServers(ns).filter((server) => {
      copyScripts(ns, server, [WORKER], true);
      return ns.hasRootAccess(server);
    });

    for (const [idx, server] of servers.entries()) {
      const ram = ns.getServerMaxRam(server) - ns.getServerUsedRam(server);
      const threads = Math.floor(ram / 4);
      if (threads > 0) {
        const job = {
          report: idx === servers.length - 1,
          port: ns.pid,
          type: 'share',
          server,
        };
        const jobPid = ns.exec(WORKER, job.server, { threads, temporary: true }, JSON.stringify(job));
        if (!jobPid) {
          ns.tprint(job);
          throw new Error('Failed to deploy job.');
        }
        await ns.sleep(0);
      }
    }

    ns.print('Waiting for shares to finish.');
    await dataPort.nextWrite();
    dataPort.clear();
  }
}
