import { NS } from '@ns';
import { WorkerCommand, WorkerStatus } from '@/hacking/lib/HGWJob';

export async function main(ns: NS): Promise<void> {
  const args = ns.args[0] as string | undefined;
  if (args === undefined) throw `Invalid arguments: ${ns.args[0]}`;

  const { target, type, port = 0, time = 0, end = 0 } = JSON.parse(args) as WorkerCommand;

  let delay = end - time - Date.now();
  if (delay < 0) {
    ns.writePort(ns.pid, -delay);
    delay = 0;
  } else {
    ns.writePort(ns.pid, 0);
  }

  await ns.weaken(target, { additionalMsec: delay });

  if (port > 0) {
    const status: WorkerStatus = {
      type,
    };
    ns.writePort(port, JSON.stringify(status));
  }
}
