import { NS } from '@ns';

export async function main(ns: NS): Promise<void> {
  while (true) {
    let money = ns.getServerMoneyAvailable('home');
    const members = ns.gang.getMemberNames();

    ns.gang
      .getEquipmentNames()
      .map((e) => ({ name: e, cost: ns.gang.getEquipmentCost(e) }))
      .sort((a, b) => a.cost - b.cost)
      .forEach(({ name, cost }) => {
        if (cost < money / 20) {
          const buys = members
            .map((m) => (ns.gang.purchaseEquipment(m, name) ? 1 : 0))
            .reduce((sum: number, a) => sum + a, 0);
          money -= cost * buys;
        }
      });

    await ns.sleep(10000);
  }
}
