import { NS } from '@ns';

export async function main(ns: NS): Promise<void> {
  const {
    once,
    server,
    _: [upgName, upgTarget],
  } = ns.flags([
    ['once', false],
    ['server', ''],
  ]) as { once: boolean; server: string; _: string[] };

  while (true) {
    if (server) {
      const secCost = ns.hacknet.hashCost('Reduce Minimum Security');
      const maxCost = ns.hacknet.hashCost('Increase Maximum Money');

      const result =
        secCost < maxCost
          ? ns.hacknet.spendHashes('Reduce Minimum Security', server)
          : ns.hacknet.spendHashes('Increase Maximum Money', server);

      if (result) continue;
      if (!result && once) break;
    } else {
      const result = ns.hacknet.spendHashes(upgName, upgTarget);
      if (result) continue;
      if (!result && once) break;
    }
    await ns.sleep(10e3);
  }
}
