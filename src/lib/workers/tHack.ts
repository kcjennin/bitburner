import { NS } from '@ns';

export async function main(ns: NS): Promise<void> {
  const port = ns.args[0] as number;
  const { target, end = 0, time = 0, report = false } = JSON.parse(ns.args[1] as string);

  let delay = end - time - Date.now();
  if (delay < 0) {
    ns.writePort(ns.pid, -delay);
    delay = 0;
  } else {
    ns.writePort(ns.pid, 0);
  }

  await ns.hack(target, { additionalMsec: delay });

  ns.atExit(() => {
    if (report) ns.writePort(port, 0);
  });
}
