import { CorpIndustryData, CorpMaterialName, CorpUpgradeName, Division, IndustryData, NS, Warehouse } from '@ns';
import { CorpResearchesData } from '../data/CorpResearchesData';
import { CorpUpgradesData } from '../data/CorpUpgradesData';
import { getCorporationLevels, getDivisionResearches, loopAllDivisionsAndCities } from './utils';

export enum CityName {
  Aevum = 'Aevum',
  Chongqing = 'Chongqing',
  Ishima = 'Ishima',
  NewTokyo = 'New Tokyo',
  Sector12 = 'Sector-12',
  Volhaven = 'Volhaven',
}

export enum CorpState {
  START = 'START',
  PURCHASE = 'PURCHASE',
  PRODUCTION = 'PRODUCTION',
  EXPORT = 'EXPORT',
  SALE = 'SALE',
}

export enum IndustryType {
  AGRICULTURE = 'Agriculture',
  CHEMICAL = 'Chemical',
  TOBACCO = 'Tobacco',
}

export interface OfficeSetupJobs {
  Operations: number;
  Engineer: number;
  Business: number;
  Management: number;
  'Research & Development': number;
  Intern?: number;
}

export interface OfficeSetup {
  city: CityName;
  size: number;
  jobs: OfficeSetupJobs;
}

export enum EmployeePositions {
  OPERATIONS = 'Operations',
  ENGINEER = 'Engineer',
  BUSINESS = 'Business',
  MANAGEMENT = 'Management',
  RESEARCH_DEVELOPMENT = 'Research & Development',
  INTERN = 'Intern',
}

export enum UnlockName {
  SMART_SUPPLY = 'Smart Supply',
}

export enum UpgradeName {
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

export enum ResearchName {
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

export enum MaterialName {
  AI_CORES = 'AI Cores',
  HARDWARE = 'Hardware',
  REAL_ESTATE = 'Real Estate',
  ROBOTS = 'Robots',
  PLANTS = 'Plants',
  CHEMICALS = 'Chemicals',
  FOOD = 'Food',
}

export interface MaterialOrder {
  city: CityName;
  materials: {
    name: MaterialName;
    count: number;
  }[];
}

export enum BenchmarkType {
  STORAGE_FACTORY,
  WILSON_ADVERT,
  OFFICE,
}

export interface StorageFactoryBenchmarkData {
  smartStorageLevel: number;
  warehouseLevel: number;
  smartFactoriesLevel: number;
  upgradeSmartStorageCost: number;
  upgradeWarehouseCost: number;
  warehouseSize: number;
  totalCost: number;
  production: number;
  costPerProduction: number;
  boostMaterials: number[];
  boostMaterialMultiplier: number;
}

export interface WilsonAdvertBenchmarkData {
  wilsonLevel: number;
  advertLevel: number;
  totalCost: number;
  popularity: number;
  awareness: number;
  ratio: number;
  advertisingFactor: number;
  costPerAdvertisingFactor: number;
}

export interface OfficeBenchmarkData {
  operations: number;
  engineer: number;
  business: number;
  management: number;
  totalExperience: number;
  rawProduction: number;
  maxSalesVolume: number;
  optimalPrice: number;
  productDevelopmentProgress: number;
  estimatedRP: number;
  productRating: number;
  productMarkup: number;
  profit: number;
}

export type CorporationUpgradeLevels = Record<UpgradeName, number>;
export type DivisionResearches = Record<ResearchName, boolean>;

const warehouseUpgradeBasePrice = 1e9;
const officeUpgradeBasePrice = 4e9;
const advertUpgradeBasePrice = 1e9;
export const productMarketPriceMultiplier = 5;

export function getDivisionRawProduction(
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
  const operationsEmployeeProduction = employeesProduction.operationsProduction;
  const engineerEmployeeProduction = employeesProduction.engineerProduction;
  const managementEmployeeProduction = employeesProduction.managementProduction;
  const totalEmployeeProduction =
    operationsEmployeeProduction + engineerEmployeeProduction + managementEmployeeProduction;
  if (totalEmployeeProduction <= 0) return 0;

  const managementFactor = 1 + managementEmployeeProduction / (1.2 * totalEmployeeProduction);
  const employeesProductionMultiplier =
    (Math.pow(operationsEmployeeProduction, 0.4) + Math.pow(engineerEmployeeProduction, 0.3)) * managementFactor;
  const balancingMultiplier = 0.05;
  let officeMultiplier = balancingMultiplier * employeesProductionMultiplier;
  if (isProduct) officeMultiplier *= 0.5;

  const upgradeMultiplier =
    1 + corporationUpgradeLevels[UpgradeName.SMART_FACTORIES] * CorpUpgradesData[UpgradeName.SMART_FACTORIES].benefit;
  let researchMultiplier = 1;
  researchMultiplier *= divisionResearches[ResearchName.DRONES_ASSEMBLY]
    ? CorpResearchesData[ResearchName.DRONES_ASSEMBLY].productionMult
    : 1;
  researchMultiplier *= divisionResearches[ResearchName.SELF_CORRECTING_ASSEMBLERS]
    ? CorpResearchesData[ResearchName.SELF_CORRECTING_ASSEMBLERS].productionMult
    : 1;
  if (isProduct)
    researchMultiplier *= divisionResearches[ResearchName.UPGRADE_FULCRUM]
      ? CorpResearchesData[ResearchName.UPGRADE_FULCRUM].productionMult
      : 1;

  return officeMultiplier * divisionProductionMultiplier * upgradeMultiplier * researchMultiplier;
}

export function getDivisionProductionMultiplier(industryData: CorpIndustryData, boostMaterials: number[]) {
  const cityMultiplier =
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    Math.pow(0.002 * boostMaterials[0] + 1, industryData.aiCoreFactor!) *
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    Math.pow(0.002 * boostMaterials[1] + 1, industryData.hardwareFactor!) *
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    Math.pow(0.002 * boostMaterials[2] + 1, industryData.realEstateFactor!) *
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    Math.pow(0.002 * boostMaterials[3] + 1, industryData.robotFactor!);
  return Math.max(Math.pow(cityMultiplier, 0.73), 1) * 6;
}

function getGenericUpgradeCost(basePrice: number, priceMultiplier: number, fromLevel: number, toLevel: number): number {
  return (
    basePrice * ((Math.pow(priceMultiplier, toLevel) - Math.pow(priceMultiplier, fromLevel)) / (priceMultiplier - 1))
  );
}

export function getUpgradeCost(upgradeName: CorpUpgradeName, fromLevel: number, toLevel: number): number {
  const upgradeData = CorpUpgradesData[upgradeName];
  if (!upgradeData) {
    throw new Error(`Cannot find data of upgrade: ${upgradeName}`);
  }
  return getGenericUpgradeCost(upgradeData.basePrice, upgradeData.priceMult, fromLevel, toLevel);
}

function getGenericMaxAffordableUpgradeLevel(
  basePrice: number,
  priceMultiplier: number,
  fromLevel: number,
  maxCost: number,
  roundingWithFloor = true,
): number {
  const maxAffordableUpgradeLevel =
    Math.log((maxCost * (priceMultiplier - 1)) / basePrice + Math.pow(priceMultiplier, fromLevel)) /
    Math.log(priceMultiplier);
  if (roundingWithFloor) {
    return Math.floor(maxAffordableUpgradeLevel);
  }
  return maxAffordableUpgradeLevel;
}

export function getMaxAffordableUpgradeLevel(upgradeName: CorpUpgradeName, fromLevel: number, maxCost: number): number {
  const upgradeData = CorpUpgradesData[upgradeName];
  if (!upgradeData) {
    throw new Error(`Cannot find data of upgrade: ${upgradeName}`);
  }
  return getGenericMaxAffordableUpgradeLevel(upgradeData.basePrice, upgradeData.priceMult, fromLevel, maxCost);
}

export function getUpgradeWarehouseCost(fromLevel: number, toLevel: number): number {
  if (fromLevel < 1) {
    throw new Error('Invalid parameter');
  }
  return warehouseUpgradeBasePrice * ((Math.pow(1.07, toLevel + 1) - Math.pow(1.07, fromLevel + 1)) / 0.07);
}

export function getMaxAffordableWarehouseLevel(fromLevel: number, maxCost: number): number {
  if (fromLevel < 1) {
    throw new Error('Invalid parameter');
  }
  return Math.floor(
    Math.log((maxCost * 0.07) / warehouseUpgradeBasePrice + Math.pow(1.07, fromLevel + 1)) / Math.log(1.07) - 1,
  );
}

export function getWarehouseSize(
  smartStorageLevel: number,
  warehouseLevel: number,
  divisionResearches: DivisionResearches,
): number {
  return (
    warehouseLevel *
    100 *
    (1 + CorpUpgradesData[UpgradeName.SMART_STORAGE].benefit * smartStorageLevel) *
    getResearchStorageMultiplier(divisionResearches)
  );
}

export function getOfficeUpgradeCost(fromSize: number, toSize: number): number {
  return getGenericUpgradeCost(officeUpgradeBasePrice, 1.09, fromSize / 3, toSize / 3);
}

export function getMaxAffordableOfficeSize(fromSize: number, maxCost: number): number {
  return Math.floor(
    3 * getGenericMaxAffordableUpgradeLevel(officeUpgradeBasePrice, 1.09, fromSize / 3, maxCost, false),
  );
}

export function getAdVertCost(fromLevel: number, toLevel: number): number {
  return getGenericUpgradeCost(advertUpgradeBasePrice, 1.06, fromLevel, toLevel);
}

export function getMaxAffordableAdVertLevel(fromLevel: number, maxCost: number): number {
  return getGenericMaxAffordableUpgradeLevel(advertUpgradeBasePrice, 1.06, fromLevel, maxCost);
}

export function getResearchMultiplier(
  divisionResearches: DivisionResearches,
  researchDataKey: keyof (typeof CorpResearchesData)[string],
): number {
  let multiplier = 1;
  for (const [researchName, researchData] of Object.entries(CorpResearchesData)) {
    if (!divisionResearches[<ResearchName>researchName]) {
      continue;
    }
    const researchDataValue = researchData[researchDataKey];
    if (!Number.isFinite(researchDataValue)) {
      throw new Error(`Invalid researchDataKey: ${researchDataKey}`);
    }
    multiplier *= researchDataValue as number;
  }
  return multiplier;
}

export function getResearchSalesMultiplier(divisionResearches: DivisionResearches): number {
  return getResearchMultiplier(divisionResearches, 'salesMult');
}

export function getResearchAdvertisingMultiplier(divisionResearches: DivisionResearches): number {
  return getResearchMultiplier(divisionResearches, 'advertisingMult');
}

export function getResearchRPMultiplier(divisionResearches: DivisionResearches): number {
  return getResearchMultiplier(divisionResearches, 'sciResearchMult');
}

export function getResearchStorageMultiplier(divisionResearches: DivisionResearches): number {
  return getResearchMultiplier(divisionResearches, 'storageMult');
}

export function getResearchEmployeeCreativityMultiplier(divisionResearches: DivisionResearches): number {
  return getResearchMultiplier(divisionResearches, 'employeeCreMult');
}

export function getResearchEmployeeCharismaMultiplier(divisionResearches: DivisionResearches): number {
  return getResearchMultiplier(divisionResearches, 'employeeChaMult');
}

export function getResearchEmployeeIntelligenceMultiplier(divisionResearches: DivisionResearches): number {
  return getResearchMultiplier(divisionResearches, 'employeeIntMult');
}

export function getResearchEmployeeEfficiencyMultiplier(divisionResearches: DivisionResearches): number {
  return getResearchMultiplier(divisionResearches, 'productionMult');
}
