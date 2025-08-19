import { NS } from '@ns';

export async function main(ns: NS): Promise<void> {
  while (true) {
    let money = ns.getServerMoneyAvailable('home');
    const members = ns.gang.getMemberNames();
    const excludes = ['NUKE Rootkit', 'Soulstealer Rootkit', 'Hmap Node', 'Demon Rootkit', 'Jack the Ripper'];

    ns.gang
      .getEquipmentNames()
      .filter((e) => !excludes.includes(e))
      .map((e) => ({ name: e, cost: ns.gang.getEquipmentCost(e) }))
      .sort((a, b) => a.cost - b.cost)
      .forEach(({ name, cost }) => {
        if (cost < money / members.length) {
          const buys = members
            .map((m) => (ns.gang.purchaseEquipment(m, name) ? 1 : 0))
            .reduce((sum: number, a) => sum + a, 0);
          money -= cost * buys;
        }
      });

    await ns.sleep(10000);
  }
}
