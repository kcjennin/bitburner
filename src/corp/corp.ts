import { NS } from '@ns';
import {
  assignJobs,
  buyAdvert,
  buyOptimalAmountOfInputMaterials,
  buyUpgrade,
  CITIES,
  clearPurchaseOrders,
  createDivision,
  DivisionName,
  findOptimalAmountOfBoostMaterials,
  generateMaterialsOrders,
  getDivisionResearches,
  getOptimalBoostMaterialQuantities,
  manageEnergyMorale,
  setSmartSupplyData,
  stockMaterials,
  upgradeWarehouse,
} from './lib/utils';
import { CityName, getWarehouseSize, IndustryType, MaterialName, UpgradeName } from './lib/formulas';
import { optimizeStorageAndFactory } from './lib/Optimizer';

interface Round1Option {
  agricultureOfficeSize: number;
  waitForAgricultureRP: number;
  boostMaterialsRatio: number;
}

const PrecalculatedRound1Options = {
  OPTION2: {
    agricultureOfficeSize: 4,
    waitForAgricultureRP: 55,
    boostMaterialsRatio: 0.86,
  },
} as const;

interface Round2Option {
  agricultureOfficeSize: number;
  increaseBusiness: boolean;
  waitForAgricultureRP: number;
  waitForChemicalRP: number;
  agricultureBoostMaterialsRatio: number;
}

const PrecalculatedRound2Option = {
  // 14.57e12 16485 815.188
  OPTION2: <Round2Option>{
    agricultureOfficeSize: 8,
    increaseBusiness: true,
    waitForAgricultureRP: 703,
    waitForChemicalRP: 393,
    agricultureBoostMaterialsRatio: 0.76,
  },
} as const;

let ns: NS;

async function round1(option: Round1Option = PrecalculatedRound1Options.OPTION2) {
  // await createDivision(ns, DivisionName.AGRICULTURE, option.agricultureOfficeSize, 1);
  // for (const city of CITIES) {
  //   ns.corporation.sellMaterial(DivisionName.AGRICULTURE, city, MaterialName.PLANTS, 'MAX', 'MP');
  //   ns.corporation.sellMaterial(DivisionName.AGRICULTURE, city, MaterialName.FOOD, 'MAX', 'MP');
  // }
  // buyAdvert(ns, DivisionName.AGRICULTURE, 2);
  // const [aiCores, hardware, realEstate, robots] = getOptimalBoostMaterialQuantities(
  //   ns.corporation.getIndustryData(IndustryType.AGRICULTURE),
  //   600 * option.boostMaterialsRatio,
  // );
  // await stockMaterials(
  //   ns,
  //   DivisionName.AGRICULTURE,
  //   CITIES.map((city) => {
  //     return {
  //       city,
  //       materials: [
  //         { name: MaterialName.AI_CORES, count: aiCores },
  //         { name: MaterialName.HARDWARE, count: hardware },
  //         { name: MaterialName.REAL_ESTATE, count: realEstate },
  //         { name: MaterialName.ROBOTS, count: robots },
  //       ],
  //     };
  //   }),
  // );
  // while (ns.corporation.getDivision(DivisionName.AGRICULTURE).researchPoints < option.waitForAgricultureRP)
  //   await ns.corporation.nextUpdate();
}

async function round2(option: Round2Option = PrecalculatedRound2Option.OPTION2) {
  const agricultureIndustryData = ns.corporation.getIndustryData(IndustryType.AGRICULTURE);
  const chemicalIndustryData = ns.corporation.getIndustryData(IndustryType.CHEMICAL);

  // const dataArray = optimizeStorageAndFactory(
  //   agricultureIndustryData,
  //   ns.corporation.getUpgradeLevel(UpgradeName.SMART_STORAGE),
  //   ns.corporation.getWarehouse(DivisionName.AGRICULTURE, CityName.Sector12).level,
  //   ns.corporation.getUpgradeLevel(UpgradeName.SMART_FACTORIES),
  //   getDivisionResearches(ns, DivisionName.AGRICULTURE),
  //   ns.corporation.getCorporation().funds,
  //   false,
  // );

  // if (dataArray.length === 0) throw 'Failed to find optimal data.';

  // const optimalData = dataArray[dataArray.length - 1];

  // buyUpgrade(ns, UpgradeName.SMART_STORAGE, optimalData.smartStorageLevel);
  // buyUpgrade(ns, UpgradeName.SMART_FACTORIES, optimalData.smartFactoriesLevel);
  // for (const city of CITIES) {
  //   upgradeWarehouse(ns, DivisionName.AGRICULTURE, city, optimalData.warehouseLevel);
  // }

  const optimalAmountOfBoostMaterialsForAgriculture = await findOptimalAmountOfBoostMaterials(
    ns,
    DivisionName.AGRICULTURE,
    agricultureIndustryData,
    CityName.Sector12,
    true,
    option.agricultureBoostMaterialsRatio,
  );
  const optimalAmountOfBoostMaterialsForChemical = await findOptimalAmountOfBoostMaterials(
    ns,
    DivisionName.CHEMICAL,
    chemicalIndustryData,
    CityName.Sector12,
    true,
    0.95,
  );
  await Promise.allSettled([
    stockMaterials(
      ns,
      DivisionName.AGRICULTURE,
      generateMaterialsOrders(CITIES, [
        { name: MaterialName.AI_CORES, count: optimalAmountOfBoostMaterialsForAgriculture[0] },
        { name: MaterialName.HARDWARE, count: optimalAmountOfBoostMaterialsForAgriculture[1] },
        { name: MaterialName.REAL_ESTATE, count: optimalAmountOfBoostMaterialsForAgriculture[2] },
        { name: MaterialName.ROBOTS, count: optimalAmountOfBoostMaterialsForAgriculture[3] },
      ]),
    ),
    stockMaterials(
      ns,
      DivisionName.CHEMICAL,
      generateMaterialsOrders(CITIES, [
        { name: MaterialName.AI_CORES, count: optimalAmountOfBoostMaterialsForChemical[0] },
        { name: MaterialName.HARDWARE, count: optimalAmountOfBoostMaterialsForChemical[1] },
        { name: MaterialName.REAL_ESTATE, count: optimalAmountOfBoostMaterialsForChemical[2] },
        { name: MaterialName.ROBOTS, count: optimalAmountOfBoostMaterialsForChemical[3] },
      ]),
    ),
  ]);
}

export async function main(nsContext: NS): Promise<void> {
  ns = nsContext;

  // if (!ns.corporation.hasCorporation()) {
  //   if (!ns.corporation.createCorporation('MCorp', true)) {
  //     throw 'Failed to create corporation.';
  //   }
  // }

  // ns.atExit(() => {
  //   clearPurchaseOrders(ns, false);
  // });

  // await manageEnergyMorale(ns, DivisionName.AGRICULTURE);

  // await round1();

  // const division = ns.corporation.getDivision(DivisionName.AGRICULTURE);
  // for (const city of division.cities) {
  //   ns.corporation.upgradeOfficeSize(division.name, city, 4);
  // }

  // assignJobs(
  //   ns,
  //   DivisionName.AGRICULTURE,
  //   CITIES.map((city) => {
  //     return {
  //       city,
  //       size: 8,
  //       jobs: {
  //         Operations: 2,
  //         Engineer: 2,
  //         Business: 2,
  //         Management: 2,
  //         'Research & Development': 0,
  //       },
  //     };
  //   }),
  // );

  await round2();
}
