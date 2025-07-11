import { NS } from '@ns';

async function runState(ns: NS, state: string): Promise<string> {
  const script = `/singularity/states/${state}.js`;
  const dataPort = ns.getPortHandle(ns.pid);
  dataPort.clear();

  if (!ns.run(script, 1, ns.pid)) {
    throw new Error(`Failed to start script: ${script}`);
  }

  await dataPort.nextWrite();
  return dataPort.read();
}

export async function main(ns: NS): Promise<void> {
  let state = 'hacking-early';
  while (true) {
    ns.toast(`State: ${state}`);
    state = await runState(ns, state);

    if (state === 'exit') {
      ns.print('State is exit.');
      return;
    }

    await ns.sleep(1000);
  }
}
