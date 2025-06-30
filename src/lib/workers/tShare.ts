import { NS } from '@ns';

export async function main(ns: NS): Promise<void> {
  const job = JSON.parse(ns.args[0].toString());
  await ns.share();
  if (job.report) {
    ns.writePort(job.port, job.type + job.server);
  }
}
