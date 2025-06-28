import { NS } from '@ns';
import { Job } from '@/lib/Job';

export async function main(ns: NS): Promise<void> {
  const job: Job = JSON.parse(ns.args[0].toString());

  let delay = job.end - job.time - Date.now();
  if (delay < 0) {
    ns.print(`WARN: Batch ${job.batch} ${job.type} was ${-delay}ms too late. (${job.end})`);
    ns.writePort(ns.pid, -delay);
    delay = 0;
  } else {
    ns.writePort(ns.pid, 0);
  }

  await ns.grow(job.target, { additionalMsec: delay });
  const end = Date.now();

  ns.atExit(() => {
    if (job.report) {
      ns.writePort(job.port, job.type + job.server);
      ns.tprint(
        `Batch ${job.batch}: ${job.type} finished at ${end.toString().slice(-6)}/${Math.round(job.end)
          .toString()
          .slice(-6)}`,
      );
    }
  });
}
