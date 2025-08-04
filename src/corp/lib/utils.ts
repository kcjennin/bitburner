import { CorpIndustryData, CorpMaterialName, Division, NS, Warehouse } from '@ns';
import {
  CityName,
  CorporationUpgradeLevels,
  CorpState,
  DivisionResearches,
  EmployeePositions,
  getDivisionRawProduction,
  IndustryType,
  MaterialName,
  MaterialOrder,
  OfficeSetup,
  ResearchName,
  // UnlockName,
  UpgradeName,
} from './formulas';
import { CorpMaterialsData } from '../data/CorpMaterialsData';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PartialRecord<K extends keyof any, T> = Partial<Record<K, T>>;

export enum DivisionName {
  AGRICULTURE = 'Agriculture',
  CHEMICAL = 'Chemical',
  TOBACCO = 'Tobacco',
}

export const CITIES: CityName[] = [
  CityName.Aevum,
  CityName.Chongqing,
  CityName.Ishima,
  CityName.NewTokyo,
  CityName.Sector12,
  CityName.Volhaven,
] as const;

export const BOOST_MATERIALS = [
  MaterialName.AI_CORES,
  MaterialName.HARDWARE,
  MaterialName.REAL_ESTATE,
  MaterialName.ROBOTS,
] as const;

const smartSupplyData: Map<string, number> = new Map<string, number>();

export async function waitUntilAfterStateHappens(ns: NS, state: CorpState): Promise<void> {
  while (true) {
    if (ns.corporation.getCorporation().prevState === state) {
      break;
    }
    await ns.corporation.nextUpdate();
  }
}

export async function manageEnergyMorale(ns: NS, divisionName: string, epsilon = 0.5): Promise<void> {
  while (true) {
    let completed = true;

    for (const city of CITIES) {
      const office = ns.corporation.getOffice(divisionName, city);

      if (office.avgMorale < office.maxMorale - epsilon) {
        ns.corporation.throwParty(divisionName, city, 500e3);
        completed = false;
      }
      if (office.avgEnergy < office.maxEnergy - epsilon) {
        ns.corporation.buyTea(divisionName, city);
        completed = false;
      }
    }

    if (completed) break;
    await ns.corporation.nextUpdate();
  }
}

export async function createDivision(
  ns: NS,
  divisionName: string,
  officeSize: number,
  warehouseLevel: number,
): Promise<Division> {
  if (!hasDivision(ns, divisionName)) {
    let industryType;

    switch (divisionName) {
      case DivisionName.AGRICULTURE:
        industryType = IndustryType.AGRICULTURE;
        break;
      case DivisionName.CHEMICAL:
        industryType = IndustryType.CHEMICAL;
        break;
      case DivisionName.TOBACCO:
        industryType = IndustryType.TOBACCO;
        break;
      default:
        throw `Invalid division: ${divisionName}`;
    }

    ns.corporation.expandIndustry(industryType, divisionName);
  }

  const division = ns.corporation.getDivision(divisionName);

  for (const city of CITIES) {
    if (!division.cities.includes(city)) {
      ns.corporation.expandCity(divisionName, city);
    }

    if (!ns.corporation.hasWarehouse(divisionName, city)) {
      ns.corporation.purchaseWarehouse(divisionName, city);
    }
  }

  upgradeOffices(
    ns,
    divisionName,
    CITIES.map((city) => {
      return {
        city,
        size: officeSize,
        jobs: {
          Business: 0,
          Engineer: 0,
          Management: 0,
          Operations: 0,
          'Research & Development': officeSize,
        },
      };
    }),
  );

  for (const city of CITIES) {
    ns.corporation.upgradeWarehouse(divisionName, city, warehouseLevel);

    // if (ns.corporation.hasUnlock(UnlockName.SMART_SUPPLY)) {
    //   ns.corporation.setSmartSupply(divisionName, city, true);
    // }
  }

  return ns.corporation.getDivision(divisionName);
}

export function hasDivision(ns: NS, divisionName: string): boolean {
  return ns.corporation.getCorporation().divisions.includes(divisionName);
}

function upgradeOffices(ns: NS, divisionName: string, officeSetups: OfficeSetup[]): void {
  for (const { city, size } of officeSetups) {
    const office = ns.corporation.getOffice(divisionName, city);

    if (office.size > size) {
      continue;
    }

    if (office.size < size) {
      ns.corporation.upgradeOfficeSize(divisionName, city, size - office.size);
    }

    // eslint-disable-next-line no-empty, prettier/prettier
    while (ns.corporation.hireEmployee(divisionName, city, EmployeePositions.RESEARCH_DEVELOPMENT)) { }
  }

  assignJobs(ns, divisionName, officeSetups);
}

export function assignJobs(ns: NS, divisionName: string, officeSetups: OfficeSetup[]): void {
  for (const { city, jobs } of officeSetups) {
    for (const jobName of Object.values(EmployeePositions)) {
      ns.corporation.setAutoJobAssignment(divisionName, city, jobName, 0);
    }

    for (const [jobName, count] of Object.entries(jobs)) {
      ns.corporation.setAutoJobAssignment(divisionName, city, jobName, count);
    }
  }
}

export function clearPurchaseOrders(ns: NS, clearInputMaterialOrders = true): void {
  loopAllDivisionsAndCities(ns, (divisionName, city) => {
    const division = ns.corporation.getDivision(divisionName);
    const industrialData = ns.corporation.getIndustryData(division.type);
    const materials = [
      ...BOOST_MATERIALS,
      ...(clearInputMaterialOrders ? Object.keys(industrialData.requiredMaterials) : []),
    ];

    for (const materialName of materials) {
      ns.corporation.buyMaterial(divisionName, city, materialName, 0);
      ns.corporation.sellMaterial(divisionName, city, materialName, '0', 'MP');
    }
  });
}

export function loopAllDivisionsAndCities(ns: NS, callback: (divisionName: string, city: CityName) => void): void {
  ns.corporation.getCorporation().divisions.forEach((division) => {
    if (!division.startsWith('---')) {
      for (const city of CITIES) {
        callback(division, city);
      }
    }
  });
}

export function upgradeWarehouse(ns: NS, divisionName: string, city: CityName, targetLevel: number): void {
  const amount = targetLevel - ns.corporation.getWarehouse(divisionName, city).level;
  if (amount < 1) {
    return;
  }
  ns.corporation.upgradeWarehouse(divisionName, city, amount);
}

export function buyAdvert(ns: NS, divisionName: string, target: number): boolean {
  for (let i = ns.corporation.getDivision(divisionName).numAdVerts; i < target; ++i) {
    ns.corporation.hireAdVert(divisionName);
  }

  return ns.corporation.getDivision(divisionName).numAdVerts === target;
}

export function buyUpgrade(ns: NS, upgrade: UpgradeName, targetLevel: number): void {
  for (let i = ns.corporation.getUpgradeLevel(upgrade); i < targetLevel; i++) {
    ns.corporation.levelUpgrade(upgrade);
  }
  if (ns.corporation.getUpgradeLevel(upgrade) < targetLevel) {
    ns.print(`ERROR: Cannot buy enough upgrade level`);
  }
}

export function buyOptimalAmountOfInputMaterials(ns: NS, warehouseCongestionData?: Map<string, number>): void {
  if (ns.corporation.getCorporation().nextState !== 'PURCHASE') {
    throw 'Used in the wrong state.';
    return;
  }

  // Loop and set buy amount
  loopAllDivisionsAndCities(ns, (divisionName, city) => {
    const division = ns.corporation.getDivision(divisionName);
    const industrialData = ns.corporation.getIndustryData(division.type);
    // const office = ns.corporation.getOffice(division.name, city);
    const requiredMaterials = Object.entries(industrialData.requiredMaterials);

    // Detect warehouse congestion
    // let isWarehouseCongested = false;
    // if (
    //   !setOfDivisionsWaitingForRP.has(divisionName) &&
    //   office.employeeJobs['Research & Development'] !== office.numEmployees
    // ) {
    //   isWarehouseCongested = detectWarehouseCongestion(ns, division, industrialData, city, warehouseCongestionData);
    // }
    // if (isWarehouseCongested) {
    //   return;
    // }

    const warehouse = ns.corporation.getWarehouse(division.name, city);
    const inputMaterials: PartialRecord<CorpMaterialName, { requiredQuantity: number; coefficient: number }> = {};
    for (const [materialName, materialCoefficient] of requiredMaterials) {
      inputMaterials[materialName as CorpMaterialName] = {
        requiredQuantity: 0,
        coefficient: materialCoefficient,
      };
    }

    // Find required quantity of input materials to produce material/product
    for (const inputMaterialData of Object.values(inputMaterials)) {
      const requiredQuantity =
        (smartSupplyData.get(buildSmartSupplyKey(divisionName, city)) ?? 0) * inputMaterialData.coefficient;
      inputMaterialData.requiredQuantity += requiredQuantity;
    }

    // Limit the input material units to max number of units that we can store in warehouse's free space
    for (const [materialName, inputMaterialData] of Object.entries(inputMaterials)) {
      const materialData = ns.corporation.getMaterialData(materialName as CorpMaterialName);
      const maxAcceptableQuantity = Math.floor((warehouse.size - warehouse.sizeUsed) / materialData.size);
      const limitedRequiredQuantity = Math.min(inputMaterialData.requiredQuantity, maxAcceptableQuantity);
      if (limitedRequiredQuantity > 0) {
        inputMaterialData.requiredQuantity = limitedRequiredQuantity;
      }
    }

    // Find which input material creates the least number of output units
    let leastAmountOfOutputUnits = Number.MAX_VALUE;
    for (const { requiredQuantity, coefficient } of Object.values(inputMaterials)) {
      const amountOfOutputUnits = requiredQuantity / coefficient;
      if (amountOfOutputUnits < leastAmountOfOutputUnits) {
        leastAmountOfOutputUnits = amountOfOutputUnits;
      }
    }

    // Align all the input materials to the smallest amount
    for (const inputMaterialData of Object.values(inputMaterials)) {
      inputMaterialData.requiredQuantity = leastAmountOfOutputUnits * inputMaterialData.coefficient;
    }

    // Calculate the total size of all input materials we are trying to buy
    let requiredSpace = 0;
    for (const [materialName, inputMaterialData] of Object.entries(inputMaterials)) {
      requiredSpace +=
        inputMaterialData.requiredQuantity * ns.corporation.getMaterialData(materialName as CorpMaterialName).size;
    }

    // If there is not enough free space, we apply a multiplier to required quantity to not overfill warehouse
    const freeSpace = warehouse.size - warehouse.sizeUsed;
    if (requiredSpace > freeSpace) {
      const constrainedStorageSpaceMultiplier = freeSpace / requiredSpace;
      for (const inputMaterialData of Object.values(inputMaterials)) {
        inputMaterialData.requiredQuantity = Math.floor(
          inputMaterialData.requiredQuantity * constrainedStorageSpaceMultiplier,
        );
      }
    }

    // Deduct the number of stored input material units from the required quantity
    for (const [materialName, inputMaterialData] of Object.entries(inputMaterials)) {
      const material = ns.corporation.getMaterial(divisionName, city, materialName);
      inputMaterialData.requiredQuantity = Math.max(0, inputMaterialData.requiredQuantity - material.stored);
    }

    // Buy input materials
    for (const [materialName, inputMaterialData] of Object.entries(inputMaterials)) {
      // ns.print(`Buying ${inputMaterialData.requiredQuantity / 10} of ${materialName}`);
      ns.corporation.buyMaterial(divisionName, city, materialName, inputMaterialData.requiredQuantity / 10);
    }
  });
}

export function getOptimalBoostMaterialQuantities(
  industryData: CorpIndustryData,
  spaceConstraint: number,
  round = true,
): number[] {
  const { aiCoreFactor, hardwareFactor, realEstateFactor, robotFactor } = industryData;
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const boostMaterialCoefficients = [aiCoreFactor!, hardwareFactor!, realEstateFactor!, robotFactor!];
  const boostMaterialSizes = BOOST_MATERIALS.map((material) => CorpMaterialsData[material].size);

  const calculateOptimalQuantities = (matCoefficients: number[], matSizes: number[]): number[] => {
    const sumOfCoefficients = matCoefficients.reduce((sum, m) => sum + m, 0);
    const sumOfSizes = matSizes.reduce((sum, m) => sum + m, 0);
    const result = [];

    for (let i = 0; i < matSizes.length; ++i) {
      let matCount =
        // eslint-disable-next-line prettier/prettier
        (spaceConstraint - 500 * ((matSizes[i] / matCoefficients[i]) * (sumOfCoefficients - matCoefficients[i]) - (sumOfSizes - matSizes[i])))
        // eslint-disable-next-line prettier/prettier
        / (sumOfCoefficients / matCoefficients[i])
        // eslint-disable-next-line prettier/prettier
        / matSizes[i];

      if (matCoefficients[i] <= 0 || matCount < 0) {
        return calculateOptimalQuantities(matCoefficients.toSpliced(i, 1), matSizes.toSpliced(i, 1));
      } else {
        if (round) {
          matCount = Math.round(matCount);
        }
        result.push(matCount);
      }
    }
    return result;
  };

  return calculateOptimalQuantities(boostMaterialCoefficients, boostMaterialSizes);
}

export async function findOptimalAmountOfBoostMaterials(
  ns: NS,
  divisionName: string,
  industryData: CorpIndustryData,
  city: CityName,
  useWarehouseSize: boolean,
  ratio: number,
): Promise<number[]> {
  const warehouseSize = ns.corporation.getWarehouse(divisionName, city).size;
  if (useWarehouseSize) {
    return getOptimalBoostMaterialQuantities(industryData, warehouseSize * ratio);
  }
  await waitUntilAfterStateHappens(ns, CorpState.PRODUCTION);
  const availableSpace =
    ns.corporation.getWarehouse(divisionName, city).size - ns.corporation.getWarehouse(divisionName, city).sizeUsed;
  return getOptimalBoostMaterialQuantities(industryData, availableSpace * ratio);
}

export function generateMaterialsOrders(
  cities: CityName[],
  materials: {
    name: MaterialName;
    count: number;
  }[],
): MaterialOrder[] {
  const orders: MaterialOrder[] = [];
  for (const city of cities) {
    orders.push({
      city: city,
      materials: materials,
    });
  }
  return orders;
}

export async function stockMaterials(
  ns: NS,
  divisionName: string,
  orders: MaterialOrder[],
  discardExceeded = false,
): Promise<void> {
  let count = 0;

  while (true) {
    if (count === 5) break;

    let finish = true;
    for (const order of orders) {
      for (const material of order.materials) {
        const storedAmount = ns.corporation.getMaterial(divisionName, order.city, material.name).stored;
        if (storedAmount === material.count) {
          ns.corporation.buyMaterial(divisionName, order.city, material.name, 0);
          ns.corporation.sellMaterial(divisionName, order.city, material.name, '0', 'MP');
          continue;
        } else if (storedAmount < material.count) {
          ns.corporation.buyMaterial(divisionName, order.city, material.name, (material.count - storedAmount) / 10);
          ns.corporation.sellMaterial(divisionName, order.city, material.name, '0', 'MP');
          finish = false;
        } else if (discardExceeded) {
          ns.corporation.buyMaterial(divisionName, order.city, material.name, 0);
          ns.corporation.sellMaterial(
            divisionName,
            order.city,
            material.name,
            ((storedAmount - material.count) / 10).toString(),
            '0',
          );
        }
      }
    }
    if (finish) break;
    while ((await ns.corporation.nextUpdate()) !== 'PURCHASE') {
      /* nothing */
    }
    count++;
  }
}

export function getCorporationLevels(ns: NS): CorporationUpgradeLevels {
  const corporationUpgradeLevels: CorporationUpgradeLevels = {
    [UpgradeName.SMART_FACTORIES]: 0,
    [UpgradeName.SMART_STORAGE]: 0,
    [UpgradeName.DREAM_SENSE]: 0,
    [UpgradeName.WILSON_ANALYTICS]: 0,
    [UpgradeName.NUOPTIMAL_NOOTROPIC_INJECTOR_IMPLANTS]: 0,
    [UpgradeName.SPEECH_PROCESSOR_IMPLANTS]: 0,
    [UpgradeName.NEURAL_ACCELERATORS]: 0,
    [UpgradeName.FOCUS_WIRES]: 0,
    [UpgradeName.ABC_SALES_BOTS]: 0,
    [UpgradeName.PROJECT_INSIGHT]: 0,
  };
  for (const upgradeName of Object.values(UpgradeName)) {
    corporationUpgradeLevels[upgradeName] = ns.corporation.getUpgradeLevel(upgradeName);
  }
  return corporationUpgradeLevels;
}

export function getDivisionResearches(ns: NS, divisionName: string): DivisionResearches {
  const divisionResearches: DivisionResearches = {
    [ResearchName.HI_TECH_RND_LABORATORY]: false,
    [ResearchName.AUTO_BREW]: false,
    [ResearchName.AUTO_PARTY]: false,
    [ResearchName.AUTO_DRUG]: false,
    [ResearchName.CPH4_INJECT]: false,
    [ResearchName.DRONES]: false,
    [ResearchName.DRONES_ASSEMBLY]: false,
    [ResearchName.DRONES_TRANSPORT]: false,
    [ResearchName.GO_JUICE]: false,
    [ResearchName.HR_BUDDY_RECRUITMENT]: false,
    [ResearchName.HR_BUDDY_TRAINING]: false,
    [ResearchName.MARKET_TA_1]: false,
    [ResearchName.MARKET_TA_2]: false,
    [ResearchName.OVERCLOCK]: false,
    [ResearchName.SELF_CORRECTING_ASSEMBLERS]: false,
    [ResearchName.STIMU]: false,
    [ResearchName.UPGRADE_CAPACITY_1]: false,
    [ResearchName.UPGRADE_CAPACITY_2]: false,
    [ResearchName.UPGRADE_DASHBOARD]: false,
    [ResearchName.UPGRADE_FULCRUM]: false,
  };
  for (const researchName of Object.values(ResearchName)) {
    divisionResearches[researchName] = ns.corporation.hasResearched(divisionName, researchName);
  }
  return divisionResearches;
}

function buildSmartSupplyKey(divisionName: string, city: CityName): string {
  return `${divisionName}|${city}`;
}

export function getRawProduction(ns: NS, division: Division, city: CityName, isProduct: boolean): number {
  const office = ns.corporation.getOffice(division.name, city);
  let rawProduction = getDivisionRawProduction(
    isProduct,
    {
      operationsProduction: office.employeeProductionByJob.Operations,
      engineerProduction: office.employeeProductionByJob.Engineer,
      managementProduction: office.employeeProductionByJob.Management,
    },
    division.productionMult,
    getCorporationLevels(ns),
    getDivisionResearches(ns, division.name),
  );
  rawProduction *= 10;
  return rawProduction;
}

export function getLimitedRawProduction(
  ns: NS,
  division: Division,
  city: CityName,
  industrialData: CorpIndustryData,
  warehouse: Warehouse,
  isProduct: boolean,
  productSize?: number,
): number {
  let rawProduction = getRawProduction(ns, division, city, isProduct);

  let requiredStorageSpaceOfEachOutputUnit = 0;
  if (isProduct) {
    if (productSize === undefined) throw 'Product size cannot be undefined.';
    requiredStorageSpaceOfEachOutputUnit += productSize;
  } else {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    for (const outputMaterialName of industrialData.producedMaterials!) {
      requiredStorageSpaceOfEachOutputUnit += ns.corporation.getMaterialData(
        outputMaterialName as CorpMaterialName,
      ).size;
    }
  }

  for (const [requiredMaterialName, requiredMaterialCoefficient] of Object.entries(industrialData.requiredMaterials)) {
    requiredStorageSpaceOfEachOutputUnit -=
      ns.corporation.getMaterialData(requiredMaterialName as CorpMaterialName).size * requiredMaterialCoefficient;
  }

  if (requiredStorageSpaceOfEachOutputUnit > 0) {
    const maxNumberOfOutputUnits = Math.floor(
      (warehouse.size - warehouse.sizeUsed) / requiredStorageSpaceOfEachOutputUnit,
    );
    rawProduction = Math.min(rawProduction, maxNumberOfOutputUnits);
  }

  rawProduction = Math.max(rawProduction, 0);
  return rawProduction;
}

export function setSmartSupplyData(ns: NS): void {
  if (ns.corporation.getCorporation().prevState !== 'PURCHASE') {
    throw 'Previous state was not purchase.';
    return;
  }

  loopAllDivisionsAndCities(ns, (divisionName: string, city: CityName) => {
    const division = ns.corporation.getDivision(divisionName);
    const industrialData = ns.corporation.getIndustryData(division.type);
    const warehouse = ns.corporation.getWarehouse(divisionName, city);
    let totalRawProduction = 0;

    if (industrialData.makesMaterials) {
      totalRawProduction += getLimitedRawProduction(ns, division, city, industrialData, warehouse, false);
    }

    if (industrialData.makesProducts) {
      for (const productName of division.products) {
        const product = ns.corporation.getProduct(divisionName, city, productName);
        if (product.developmentProgress < 100) {
          continue;
        }

        totalRawProduction += getLimitedRawProduction(ns, division, city, industrialData, warehouse, true);
      }
    }

    ns.print(`Configuring ${divisionName}|${city} to ${totalRawProduction}`);
    smartSupplyData.set(buildSmartSupplyKey(divisionName, city), totalRawProduction);
  });
}
