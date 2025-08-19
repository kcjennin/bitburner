import { NS } from '@ns';
import { AGRI_NAME, teaAndParty, waitState } from './utils';

export async function main(ns: NS) {
  if (!ns.corporation.hasCorporation()) {
    throw 'Corporation not created.';
  }

  const cities = Object.values(ns.enums.CityName);

  ns.corporation.expandIndustry(AGRI_NAME, AGRI_NAME);
  const division = ns.corporation.getDivision(AGRI_NAME);
  for (const city of cities) {
    if (!division.cities.includes(city)) ns.corporation.expandCity(AGRI_NAME, city);
    ns.corporation.upgradeOfficeSize(AGRI_NAME, city, 1);
    if (!ns.corporation.hasWarehouse(AGRI_NAME, city)) ns.corporation.purchaseWarehouse(AGRI_NAME, city);
    ns.corporation.upgradeWarehouse(AGRI_NAME, city, 5);

    while (ns.corporation.hireEmployee(AGRI_NAME, city, 'Research & Development'));
  }
  while (ns.corporation.getUpgradeLevel('Smart Storage') < 6) ns.corporation.levelUpgrade('Smart Storage');

  ns.corporation.hireAdVert(AGRI_NAME);
  ns.corporation.hireAdVert(AGRI_NAME);

  await teaAndParty(ns, [AGRI_NAME]);

  // wait until RP is 55
  while (ns.corporation.getDivision(AGRI_NAME).researchPoints < 55) await waitState(ns, 'START');

  // buy boost materials
  const aiCores = 1733;
  const hardware = 1981;
  const realEstate = 106686;
  const robots = 0;

  for (const city of cities) {
    ns.corporation.buyMaterial(AGRI_NAME, city, 'AI Cores', aiCores / 10);
    ns.corporation.buyMaterial(AGRI_NAME, city, 'Hardware', hardware / 10);
    ns.corporation.buyMaterial(AGRI_NAME, city, 'Real Estate', realEstate / 10);
    ns.corporation.buyMaterial(AGRI_NAME, city, 'Robots', robots / 10);
  }

  await waitState(ns, 'PURCHASE');

  for (const city of cities) {
    ns.corporation.buyMaterial(AGRI_NAME, city, 'AI Cores', 0);
    ns.corporation.buyMaterial(AGRI_NAME, city, 'Hardware', 0);
    ns.corporation.buyMaterial(AGRI_NAME, city, 'Real Estate', 0);
    ns.corporation.buyMaterial(AGRI_NAME, city, 'Robots', 0);

    ns.corporation.sellMaterial(AGRI_NAME, city, 'Plants', 'MAX', 'MP');
    ns.corporation.sellMaterial(AGRI_NAME, city, 'Food', 'MAX', 'MP');

    ns.corporation.setAutoJobAssignment(AGRI_NAME, city, 'Research & Development', 0);
    ns.corporation.setAutoJobAssignment(AGRI_NAME, city, 'Operations', 1);
    ns.corporation.setAutoJobAssignment(AGRI_NAME, city, 'Engineer', 1);
    ns.corporation.setAutoJobAssignment(AGRI_NAME, city, 'Business', 1);
    ns.corporation.setAutoJobAssignment(AGRI_NAME, city, 'Management', 1);
  }

  ns.run('/corp/smart-supply.js', { preventDuplicates: true });

  ns.toast(`Finished with Round 1.`, 'success', 10000);

  if (ns.args.includes('--auto')) {
    ns.run('/corp/round-two.js', { preventDuplicates: true }, '--auto');
  }
}
