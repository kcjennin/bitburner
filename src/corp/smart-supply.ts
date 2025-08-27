import { CityName, CorpIndustryData, CorpMaterialName, Division, NS, Warehouse } from '@ns';
import { CorpResearchesData } from './data/CorpResearchesData';
import { CorpUpgradesData } from './data/CorpUpgradesData';

type PartialRecord<K extends string, V> = Partial<Record<K, V>>;
const getRecordEntries = Object.entries as <K extends string, V>(record: PartialRecord<K, V>) => [K, V][];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getRecordValues = Object.values as <V>(record: PartialRecord<any, V>) => V[];

enum UpgradeName {
  SMART_FACTORIES = 'Smart Factories',
  SMART_STORAGE = 'Smart Storage',
  DREAM_SENSE = 'DreamSense',
  WILSON_ANALYTICS = 'Wilson Analytics',
  NUOPTIMAL_NOOTROPIC_INJECTOR_IMPLANTS = 'Nuoptimal Nootropic Injector Implants',
  SPEECH_PROCESSOR_IMPLANTS = 'Speech Processor Implants',
  NEURAL_ACCELERATORS = 'Neural Accelerators',
  FOCUS_WIRES = 'FocusWires',
  ABC_SALES_BOTS = 'ABC SalesBots',
  PROJECT_INSIGHT = 'Project Insight',
}

enum ResearchName {
  HI_TECH_RND_LABORATORY = 'Hi-Tech R&D Laboratory',
  AUTO_BREW = 'AutoBrew',
  AUTO_PARTY = 'AutoPartyManager',
  AUTO_DRUG = 'Automatic Drug Administration',
  CPH4_INJECT = 'CPH4 Injections',
  DRONES = 'Drones',
  DRONES_ASSEMBLY = 'Drones - Assembly',
  DRONES_TRANSPORT = 'Drones - Transport',
  GO_JUICE = 'Go-Juice',
  HR_BUDDY_RECRUITMENT = 'HRBuddy-Recruitment',
  HR_BUDDY_TRAINING = 'HRBuddy-Training',
  MARKET_TA_1 = 'Market-TA.I',
  MARKET_TA_2 = 'Market-TA.II',
  OVERCLOCK = 'Overclock',
  SELF_CORRECTING_ASSEMBLERS = 'Self-Correcting Assemblers',
  STIMU = 'Sti.mu',
  UPGRADE_CAPACITY_1 = 'uPgrade: Capacity.I',
  UPGRADE_CAPACITY_2 = 'uPgrade: Capacity.II',
  UPGRADE_DASHBOARD = 'uPgrade: Dashboard',
  UPGRADE_FULCRUM = 'uPgrade: Fulcrum',
}

type CorporationUpgradeLevels = Record<UpgradeName, number>;
type DivisionResearches = Record<ResearchName, boolean>;

const smartSupplyData: Map<string, number> = new Map<string, number>();

export function buyOptimalAmountOfInputMaterials(ns: NS): void {
  if (ns.corporation.getCorporation().nextState !== 'PURCHASE') {
    return;
  }
  // Loop and set buy amount
  loopAllDivisionsAndCities(ns, (divisionName, city) => {
    const division = ns.corporation.getDivision(divisionName);
    const industrialData = ns.corporation.getIndustryData(division.type);
    const requiredMaterials = getRecordEntries(industrialData.requiredMaterials);

    const warehouse = ns.corporation.getWarehouse(division.name, city);
    const inputMaterials: PartialRecord<
      CorpMaterialName,
      {
        requiredQuantity: number;
        coefficient: number;
      }
    > = {};
    for (const [materialName, materialCoefficient] of requiredMaterials) {
      inputMaterials[materialName] = {
        requiredQuantity: 0,
        coefficient: materialCoefficient,
      };
    }

    // Find required quantity of input materials to produce material/product
    for (const inputMaterialData of getRecordValues(inputMaterials)) {
      const requiredQuantity =
        (smartSupplyData.get(buildSmartSupplyKey(divisionName, city)) ?? 0) * inputMaterialData.coefficient;
      inputMaterialData.requiredQuantity += requiredQuantity;
    }

    // Limit the input material units to max number of units that we can store in warehouse's free space
    for (const [materialName, inputMaterialData] of getRecordEntries(inputMaterials)) {
      const materialData = ns.corporation.getMaterialData(materialName);
      const maxAcceptableQuantity = Math.floor((warehouse.size - warehouse.sizeUsed) / materialData.size);
      const limitedRequiredQuantity = Math.min(inputMaterialData.requiredQuantity, maxAcceptableQuantity);
      if (limitedRequiredQuantity > 0) {
        inputMaterialData.requiredQuantity = limitedRequiredQuantity;
      }
    }

    // Find which input material creates the least number of output units
    let leastAmountOfOutputUnits = Number.MAX_VALUE;
    for (const { requiredQuantity, coefficient } of getRecordValues(inputMaterials)) {
      const amountOfOutputUnits = requiredQuantity / coefficient;
      if (amountOfOutputUnits < leastAmountOfOutputUnits) {
        leastAmountOfOutputUnits = amountOfOutputUnits;
      }
    }

    // Align all the input materials to the smallest amount
    for (const inputMaterialData of getRecordValues(inputMaterials)) {
      inputMaterialData.requiredQuantity = leastAmountOfOutputUnits * inputMaterialData.coefficient;
    }

    // Calculate the total size of all input materials we are trying to buy
    let requiredSpace = 0;
    for (const [materialName, inputMaterialData] of getRecordEntries(inputMaterials)) {
      requiredSpace += inputMaterialData.requiredQuantity * ns.corporation.getMaterialData(materialName).size;
    }

    // If there is not enough free space, we apply a multiplier to required quantity to not overfill warehouse
    const freeSpace = warehouse.size - warehouse.sizeUsed;
    if (requiredSpace > freeSpace) {
      const constrainedStorageSpaceMultiplier = freeSpace / requiredSpace;
      for (const inputMaterialData of getRecordValues(inputMaterials)) {
        inputMaterialData.requiredQuantity = Math.floor(
          inputMaterialData.requiredQuantity * constrainedStorageSpaceMultiplier,
        );
      }
    }

    // Deduct the number of stored input material units from the required quantity
    for (const [materialName, inputMaterialData] of getRecordEntries(inputMaterials)) {
      const material = ns.corporation.getMaterial(divisionName, city, materialName);
      inputMaterialData.requiredQuantity = Math.max(0, inputMaterialData.requiredQuantity - material.stored);
    }

    // Buy input materials
    for (const [materialName, inputMaterialData] of getRecordEntries(inputMaterials)) {
      ns.corporation.buyMaterial(divisionName, city, materialName, inputMaterialData.requiredQuantity / 10);
    }
  });
}

export function setSmartSupplyData(ns: NS): void {
  // Only set smart supply data after "PURCHASE" state
  if (ns.corporation.getCorporation().prevState !== 'PURCHASE') {
    return;
  }
  loopAllDivisionsAndCities(ns, (divisionName, city) => {
    const division = ns.corporation.getDivision(divisionName);
    const industrialData = ns.corporation.getIndustryData(division.type);
    const warehouse = ns.corporation.getWarehouse(division.name, city);
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
        totalRawProduction += getLimitedRawProduction(
          ns,
          division,
          city,
          industrialData,
          warehouse,
          true,
          product.size,
        );
      }
    }

    smartSupplyData.set(buildSmartSupplyKey(divisionName, city), totalRawProduction);
  });
}

function loopAllDivisionsAndCities(ns: NS, callback: (divisionName: string, city: CityName) => void): void {
  for (const division of ns.corporation.getCorporation().divisions) {
    for (const city of Object.values(ns.enums.CityName)) {
      callback(division, city);
    }
  }
}

function getCorporationUpgradeLevels(ns: NS): CorporationUpgradeLevels {
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

function getDivisionResearches(ns: NS, divisionName: string): DivisionResearches {
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

function getDivisionRawProduction(
  isProduct: boolean,
  employeesProduction: {
    operationsProduction: number;
    engineerProduction: number;
    managementProduction: number;
  },
  divisionProductionMultiplier: number,
  corporationUpgradeLevels: CorporationUpgradeLevels,
  divisionResearches: DivisionResearches,
): number {
  const operationEmployeesProduction = employeesProduction.operationsProduction;
  const engineerEmployeesProduction = employeesProduction.engineerProduction;
  const managementEmployeesProduction = employeesProduction.managementProduction;
  const totalEmployeesProduction =
    operationEmployeesProduction + engineerEmployeesProduction + managementEmployeesProduction;
  if (totalEmployeesProduction <= 0) {
    return 0;
  }
  const managementFactor = 1 + managementEmployeesProduction / (1.2 * totalEmployeesProduction);
  const employeesProductionMultiplier =
    (Math.pow(operationEmployeesProduction, 0.4) + Math.pow(engineerEmployeesProduction, 0.3)) * managementFactor;
  const balancingMultiplier = 0.05;
  let officeMultiplier;
  if (isProduct) {
    officeMultiplier = 0.5 * balancingMultiplier * employeesProductionMultiplier;
  } else {
    officeMultiplier = balancingMultiplier * employeesProductionMultiplier;
  }

  // Multiplier from Smart Factories
  const upgradeMultiplier =
    1 + corporationUpgradeLevels[UpgradeName.SMART_FACTORIES] * CorpUpgradesData[UpgradeName.SMART_FACTORIES].benefit;
  // Multiplier from researches
  let researchMultiplier = 1;
  researchMultiplier *=
    (divisionResearches[ResearchName.DRONES_ASSEMBLY]
      ? CorpResearchesData[ResearchName.DRONES_ASSEMBLY].productionMult
      : 1) *
    (divisionResearches[ResearchName.SELF_CORRECTING_ASSEMBLERS]
      ? CorpResearchesData[ResearchName.SELF_CORRECTING_ASSEMBLERS].productionMult
      : 1);
  if (isProduct) {
    researchMultiplier *= divisionResearches[ResearchName.UPGRADE_FULCRUM]
      ? CorpResearchesData[ResearchName.UPGRADE_FULCRUM].productProductionMult
      : 1;
  }

  return officeMultiplier * divisionProductionMultiplier * upgradeMultiplier * researchMultiplier;
}

function buildSmartSupplyKey(divisionName: string, city: CityName): string {
  return `${divisionName}|${city}`;
}

function getRawProduction(ns: NS, division: Division, city: CityName, isProduct: boolean): number {
  const office = ns.corporation.getOffice(division.name, city);
  let rawProduction = getDivisionRawProduction(
    isProduct,
    {
      operationsProduction: office.employeeProductionByJob.Operations,
      engineerProduction: office.employeeProductionByJob.Engineer,
      managementProduction: office.employeeProductionByJob.Management,
    },
    division.productionMult,
    getCorporationUpgradeLevels(ns),
    getDivisionResearches(ns, division.name),
  );
  rawProduction = rawProduction * 10;
  return rawProduction;
}

function getLimitedRawProduction(
  ns: NS,
  division: Division,
  city: CityName,
  industrialData: CorpIndustryData,
  warehouse: Warehouse,
  isProduct: boolean,
  productSize?: number,
): number {
  let rawProduction = getRawProduction(ns, division, city, isProduct);

  // Calculate required storage space of each output unit. It is the net change in warehouse's storage space when
  // producing an output unit.
  let requiredStorageSpaceOfEachOutputUnit = 0;
  if (isProduct) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    requiredStorageSpaceOfEachOutputUnit += productSize!;
  } else {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    for (const outputMaterialName of industrialData.producedMaterials!) {
      requiredStorageSpaceOfEachOutputUnit += ns.corporation.getMaterialData(outputMaterialName).size;
    }
  }
  for (const [requiredMaterialName, requiredMaterialCoefficient] of getRecordEntries(
    industrialData.requiredMaterials,
  )) {
    requiredStorageSpaceOfEachOutputUnit -=
      ns.corporation.getMaterialData(requiredMaterialName).size * requiredMaterialCoefficient;
  }
  // Limit the raw production if needed
  if (requiredStorageSpaceOfEachOutputUnit > 0) {
    const maxNumberOfOutputUnits = Math.floor(
      (warehouse.size - warehouse.sizeUsed) / requiredStorageSpaceOfEachOutputUnit,
    );
    rawProduction = Math.min(rawProduction, maxNumberOfOutputUnits);
  }

  rawProduction = Math.max(rawProduction, 0);
  return rawProduction;
}
