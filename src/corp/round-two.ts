import { NS } from '@ns';
import { AGRI_NAME, CHEM_NAME, teaAndParty, waitState } from './utils';

export async function main(ns: NS) {
  if (!ns.corporation.hasCorporation()) {
    throw 'Corporation not created.';
  }

  if (ns.corporation.getCorporation().funds < 490e9) {
    throw 'Not enough money. Did you accept investors?';
  }

  const cities = Object.values(ns.enums.CityName);

  // try not to clog up the warehouse
  await waitState(ns, 'PURCHASE');
  ns.scriptKill('/corp/smart-supply.js', 'home');
  for (const city of cities) {
    ns.corporation.buyMaterial(AGRI_NAME, city, 'Water', 0);
    ns.corporation.buyMaterial(AGRI_NAME, city, 'Chemicals', 0);
  }

  ns.corporation.purchaseUnlock('Export');
  while (ns.corporation.getUpgradeLevel('Smart Storage') < 25) ns.corporation.levelUpgrade('Smart Storage');
  while (ns.corporation.getUpgradeLevel('Smart Factories') < 20) ns.corporation.levelUpgrade('Smart Factories');

  // Upgrade Agriculture division
  for (const city of cities) {
    ns.corporation.upgradeOfficeSize(AGRI_NAME, city, 4);
    ns.corporation.upgradeWarehouse(AGRI_NAME, city, 10);
    while (ns.corporation.hireEmployee(AGRI_NAME, city, 'Research & Development'));

    ns.corporation.setAutoJobAssignment(AGRI_NAME, city, 'Operations', 0);
    ns.corporation.setAutoJobAssignment(AGRI_NAME, city, 'Engineer', 0);
    ns.corporation.setAutoJobAssignment(AGRI_NAME, city, 'Business', 0);
    ns.corporation.setAutoJobAssignment(AGRI_NAME, city, 'Management', 0);
    ns.corporation.setAutoJobAssignment(AGRI_NAME, city, 'Research & Development', 8);
  }
  for (let _ = 0; _ < 6; ++_) ns.corporation.hireAdVert(AGRI_NAME);

  // Chem division
  ns.corporation.expandIndustry(CHEM_NAME, CHEM_NAME);
  const division = ns.corporation.getDivision(CHEM_NAME);
  for (const city of cities) {
    if (!division.cities.includes(city)) ns.corporation.expandCity(CHEM_NAME, city);
    if (!ns.corporation.hasWarehouse(CHEM_NAME, city)) ns.corporation.purchaseWarehouse(CHEM_NAME, city);
    ns.corporation.upgradeWarehouse(CHEM_NAME, city, 1);

    while (ns.corporation.hireEmployee(CHEM_NAME, city, 'Research & Development'));
  }

  await teaAndParty(ns, [AGRI_NAME, CHEM_NAME]);

  // wait until RP is 55
  while (ns.corporation.getDivision(AGRI_NAME).researchPoints < 700) await waitState(ns, 'START');
  while (ns.corporation.getDivision(CHEM_NAME).researchPoints < 390) await waitState(ns, 'START');

  // buy boost materials
  const agAiCores = 8556;
  const agHardware = 9563;
  const agRealEstate = 434200;
  const agRobots = 1311;

  const chAiCores = 1717;
  const chHardware = 3194;
  const chRealEstate = 54917;
  const chRobots = 54;

  for (const city of cities) {
    // start buying boosts
    ns.corporation.buyMaterial(AGRI_NAME, city, 'AI Cores', agAiCores / 10);
    ns.corporation.buyMaterial(AGRI_NAME, city, 'Hardware', agHardware / 10);
    ns.corporation.buyMaterial(AGRI_NAME, city, 'Real Estate', agRealEstate / 10);
    ns.corporation.buyMaterial(AGRI_NAME, city, 'Robots', agRobots / 10);

    ns.corporation.buyMaterial(CHEM_NAME, city, 'AI Cores', chAiCores / 10);
    ns.corporation.buyMaterial(CHEM_NAME, city, 'Hardware', chHardware / 10);
    ns.corporation.buyMaterial(CHEM_NAME, city, 'Real Estate', chRealEstate / 10);
    ns.corporation.buyMaterial(CHEM_NAME, city, 'Robots', chRobots / 10);
  }

  await waitState(ns, 'PURCHASE');

  for (const city of cities) {
    // stop buying boosts
    ns.corporation.buyMaterial(AGRI_NAME, city, 'AI Cores', 0);
    ns.corporation.buyMaterial(AGRI_NAME, city, 'Hardware', 0);
    ns.corporation.buyMaterial(AGRI_NAME, city, 'Real Estate', 0);
    ns.corporation.buyMaterial(AGRI_NAME, city, 'Robots', 0);

    ns.corporation.buyMaterial(CHEM_NAME, city, 'AI Cores', 0);
    ns.corporation.buyMaterial(CHEM_NAME, city, 'Hardware', 0);
    ns.corporation.buyMaterial(CHEM_NAME, city, 'Real Estate', 0);
    ns.corporation.buyMaterial(CHEM_NAME, city, 'Robots', 0);

    // sales
    ns.corporation.sellMaterial(AGRI_NAME, city, 'Plants', 'MAX', 'MP');
    ns.corporation.sellMaterial(AGRI_NAME, city, 'Food', 'MAX', 'MP');

    ns.corporation.sellMaterial(CHEM_NAME, city, 'Chemicals', 'MAX', 'MP');

    // exports
    ns.corporation.exportMaterial(AGRI_NAME, city, CHEM_NAME, city, 'Plants', '(IPROD+IINV/10)*(-1)');
    ns.corporation.exportMaterial(CHEM_NAME, city, AGRI_NAME, city, 'Chemicals', '(IPROD+IINV/10)*(-1)');

    // jobs
    ns.corporation.setAutoJobAssignment(AGRI_NAME, city, 'Research & Development', 0);
    ns.corporation.setAutoJobAssignment(AGRI_NAME, city, 'Operations', 3);
    ns.corporation.setAutoJobAssignment(AGRI_NAME, city, 'Engineer', 1);
    ns.corporation.setAutoJobAssignment(AGRI_NAME, city, 'Business', 2);
    ns.corporation.setAutoJobAssignment(AGRI_NAME, city, 'Management', 2);

    ns.corporation.setAutoJobAssignment(CHEM_NAME, city, 'Research & Development', 0);
    ns.corporation.setAutoJobAssignment(CHEM_NAME, city, 'Operations', 1);
    ns.corporation.setAutoJobAssignment(CHEM_NAME, city, 'Engineer', 1);
    ns.corporation.setAutoJobAssignment(CHEM_NAME, city, 'Business', 1);
  }

  ns.run('/corp/smart-supply.js', { preventDuplicates: true });

  ns.toast(`Finished with Round 2.`, 'success', 10000);
}
