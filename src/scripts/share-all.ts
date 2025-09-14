import { getCacheData, ServersCache } from '@/lib/Cache';
import { NS } from '@ns';

const WORKER = '/scripts/workers/tShare.js';

export async function main(ns: NS): Promise<void> {
  const dataPort = ns.getPortHandle(ns.pid);
  dataPort.clear();

  while (true) {
    const servers = getCacheData(ns, ServersCache)
      .filter((s) => s.hasAdminRights)
      .map((s) => s.hostname);

    let numJobs = 0;
    for (const server of servers) {
      const ram = Math.max(ns.getServerMaxRam(server) - ns.getServerUsedRam(server) - (server === 'home' ? 32 : 0), 0);
      const threads = Math.floor(ram / 4);
      if (threads > 0) {
        const job = {
          report: true,
          port: ns.pid,
          type: 'share',
          server,
        };
        const jobPid = ns.exec(WORKER, job.server, { threads, temporary: true }, JSON.stringify(job));
        if (!jobPid) {
          ns.tprint(job);
          throw new Error('Failed to deploy job.');
        }
        numJobs++;
      }
    }

    while (numJobs > 0) {
      if (dataPort.empty()) await dataPort.nextWrite();
      dataPort.read();
      numJobs--;
    }
  }
}
