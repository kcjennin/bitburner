import { CorpStateName, NS } from '@ns';

// export async function main(ns: NS): Promise<void> {
//   while (true) {
//     await waitState(ns, 'START');
//     buyOptimalAmountOfInputMaterials(ns);

//     await waitState(ns, 'PURCHASE');
//     setSmartSupplyData(ns);
//   }
// }

export async function main(ns: NS): Promise<void> {
  const corpName = 'KCorp';
  const divisionName = 'AgriDiv';
  const cities = Object.values(ns.enums.CityName);
  const targetOfficeSize = 4;
  const rpThreshold = 55;

  // create corp
  if (!ns.corporation.hasCorporation()) {
    ns.corporation.createCorporation(corpName, false);
  }

  // expand to agriculture
  const corp = ns.corporation.getCorporation();
  if (!corp.divisions.some((d) => d === divisionName)) {
    ns.corporation.expandIndustry('Agriculture', divisionName);
  }

  // create offices in every city
  const division = ns.corporation.getDivision(divisionName);
  for (const city of cities) {
    if (!division.cities.includes(city)) {
      ns.corporation.expandCity(division.name, city);
    }

    // all offices need a warehouse
    if (!ns.corporation.hasWarehouse(divisionName, city)) {
      ns.corporation.purchaseWarehouse(divisionName, city);
    }

    // upgrade the office size
    const office = ns.corporation.getOffice(divisionName, city);
    if (office.size < targetOfficeSize) {
      ns.corporation.upgradeOfficeSize(divisionName, city, targetOfficeSize - office.size);
    }

    // hire employees
    while (ns.corporation.hireEmployee(divisionName, city, 'Research & Development'));
  }

  // wait until RP threshold before continuing
  while (ns.corporation.getDivision(divisionName).researchPoints < rpThreshold) {
    await waitState(ns, 'START');
  }
}

async function waitState(ns: NS, state: CorpStateName) {
  while ((await ns.corporation.nextUpdate()) !== state);
}
