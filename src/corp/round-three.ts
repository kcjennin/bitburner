import { NS } from '@ns';
import { AGRI_NAME, CHEM_NAME, TOBA_NAME, teaAndParty, waitState } from './utils';

export async function main(ns: NS) {
  if (!ns.corporation.hasCorporation()) {
    throw 'Corporation not created.';
  }

  const cities = Object.values(ns.enums.CityName);

  // try not to clog up the warehouse
  await waitState(ns, 'PURCHASE');
  ns.scriptKill('/corp/smart-supply.js', 'home');
  for (const city of cities) {
    ns.corporation.buyMaterial(AGRI_NAME, city, 'Water', 0);
    ns.corporation.buyMaterial(AGRI_NAME, city, 'Chemicals', 0);
  }

  // Tobacco division
  if (!ns.corporation.getCorporation().divisions.includes(TOBA_NAME))
    ns.corporation.expandIndustry(TOBA_NAME, TOBA_NAME);
  const division = ns.corporation.getDivision(TOBA_NAME);
  for (const city of cities) {
    if (!division.cities.includes(city)) ns.corporation.expandCity(TOBA_NAME, city);
    if (!ns.corporation.hasWarehouse(TOBA_NAME, city)) ns.corporation.purchaseWarehouse(TOBA_NAME, city);
    ns.corporation.upgradeWarehouse(TOBA_NAME, city, 1);
    ns.corporation.upgradeOfficeSize(TOBA_NAME, city, 3);
    while (ns.corporation.hireEmployee(CHEM_NAME, city, 'Research & Development'));
  }

  await teaAndParty(ns, [AGRI_NAME, CHEM_NAME, TOBA_NAME]);

  const tbAiCores = 1717;
  const tbHardware = 3194;
  const tbRealEstate = 54917;
  const tbRobots = 54;

  for (const city of cities) {
    // start buying boosts
    ns.corporation.buyMaterial(TOBA_NAME, city, 'AI Cores', tbAiCores / 10);
    ns.corporation.buyMaterial(TOBA_NAME, city, 'Hardware', tbHardware / 10);
    ns.corporation.buyMaterial(TOBA_NAME, city, 'Real Estate', tbRealEstate / 10);
    ns.corporation.buyMaterial(TOBA_NAME, city, 'Robots', tbRobots / 10);
  }

  await waitState(ns, 'PURCHASE');

  for (const city of cities) {
    // stop buying boosts
    ns.corporation.buyMaterial(TOBA_NAME, city, 'AI Cores', 0);
    ns.corporation.buyMaterial(TOBA_NAME, city, 'Hardware', 0);
    ns.corporation.buyMaterial(TOBA_NAME, city, 'Real Estate', 0);
    ns.corporation.buyMaterial(TOBA_NAME, city, 'Robots', 0);

    // exports
    ns.corporation.cancelExportMaterial(AGRI_NAME, city, CHEM_NAME, city, 'Plants');
    ns.corporation.cancelExportMaterial(AGRI_NAME, city, TOBA_NAME, city, 'Plants');
    ns.corporation.exportMaterial(AGRI_NAME, city, TOBA_NAME, city, 'Plants', '(IPROD+IINV/10)*(-1)');

    // jobs
    ns.corporation.setAutoJobAssignment(TOBA_NAME, city, 'Research & Development', 0);
  }

  await waitState(ns, 'START');
  await waitState(ns, 'START');

  for (const city of cities) {
    ns.corporation.setAutoJobAssignment(TOBA_NAME, city, 'Research & Development', 3);
    ns.corporation.setAutoJobAssignment(TOBA_NAME, city, 'Operations', 1);
    ns.corporation.setAutoJobAssignment(TOBA_NAME, city, 'Engineer', 1);
    ns.corporation.setAutoJobAssignment(TOBA_NAME, city, 'Business', 1);
  }

  ns.run('/corp/smart-supply.js', { preventDuplicates: true });
  ns.run('/corp/teaParty.js', { preventDuplicates: true });

  ns.toast(`Finished with Round 3.`, 'success', 10000);
}
