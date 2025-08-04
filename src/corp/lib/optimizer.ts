import { CorpIndustryData } from '@ns';
import { CorpUpgradesData } from '../data/CorpUpgradesData';
import {
  BenchmarkType,
  DivisionResearches,
  getDivisionProductionMultiplier,
  getMaxAffordableUpgradeLevel,
  getMaxAffordableWarehouseLevel,
  getUpgradeCost,
  getUpgradeWarehouseCost,
  getWarehouseSize,
  OfficeBenchmarkData,
  StorageFactoryBenchmarkData,
  UpgradeName,
  WilsonAdvertBenchmarkData,
} from './formulas';
import { getOptimalBoostMaterialQuantities } from './utils';
import { PriorityQueue } from '@/lib/PriorityQueue';

export interface ComparatorCustomData {
  referenceData: OfficeBenchmarkData;
  balancingModifierForProfitProgress: {
    profit: number;
    progress: number;
  };
}

const defaultMinForNormalization = 5;
const defaultMaxForNormalization = 200;
const referenceValueModifier = 10;
const defaultLengthOfBenchmarkDataArray = 10;

export function scaleValueToRange(
  value: number,
  currentMin: number,
  currentMax: number,
  newMin: number,
  newMax: number,
): number {
  return ((value - currentMin) * (newMax - newMin)) / (currentMax - currentMin) + newMin;
}

export function normalizeProfit(profit: number, referenceValue: number): number {
  return scaleValueToRange(
    profit,
    referenceValue / referenceValueModifier,
    referenceValue * referenceValueModifier,
    defaultMinForNormalization,
    defaultMaxForNormalization,
  );
}

export function normalizeProgress(progress: number): number {
  return scaleValueToRange(progress, 0, 100, defaultMinForNormalization, defaultMaxForNormalization);
}

export function getComparator(
  benchmarkType: BenchmarkType,
  sortType?: string,
  customData?: ComparatorCustomData,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): (a: any, b: any) => number {
  switch (benchmarkType) {
    case BenchmarkType.STORAGE_FACTORY:
      return (a: StorageFactoryBenchmarkData, b: StorageFactoryBenchmarkData) => {
        if (!a || !b) {
          return 1;
        }
        if (a.production !== b.production) {
          return a.production - b.production;
        }
        return b.totalCost - a.totalCost;
      };
    case BenchmarkType.WILSON_ADVERT:
      return (a: WilsonAdvertBenchmarkData, b: WilsonAdvertBenchmarkData) => {
        if (!a || !b) {
          return 1;
        }
        if (sortType === 'totalCost') {
          return b.totalCost - a.totalCost;
        }
        if (a.advertisingFactor !== b.advertisingFactor) {
          return a.advertisingFactor - b.advertisingFactor;
        }
        return b.totalCost - a.totalCost;
      };
    case BenchmarkType.OFFICE:
      return (a: OfficeBenchmarkData, b: OfficeBenchmarkData) => {
        if (!a || !b) {
          return 1;
        }
        if (a.totalExperience !== b.totalExperience) {
          return a.totalExperience - b.totalExperience;
        }
        if (sortType === 'rawProduction') {
          return a.rawProduction - b.rawProduction;
        }
        if (sortType === 'progress') {
          return a.productDevelopmentProgress - b.productDevelopmentProgress;
        }
        if (sortType === 'profit') {
          return a.profit - b.profit;
        }
        if (!customData) {
          throw new Error(`Invalid custom data`);
        }
        const normalizedProfitOfA = normalizeProfit(a.profit, customData.referenceData.profit);
        const normalizedProgressOfA = normalizeProgress(Math.ceil(100 / a.productDevelopmentProgress));
        const normalizedProfitOfB = normalizeProfit(b.profit, customData.referenceData.profit);
        const normalizedProgressOfB = normalizeProgress(Math.ceil(100 / b.productDevelopmentProgress));
        if (!Number.isFinite(normalizedProfitOfA) || !Number.isFinite(normalizedProfitOfB)) {
          throw `Invalid profit: a.profit: ${a.profit.toExponential()}, b.profit: ${b.profit.toExponential()}, referenceData.profit: ${customData.referenceData.profit.toExponential()}`;
        }
        if (sortType === 'profit_progress') {
          return (
            customData.balancingModifierForProfitProgress.profit * normalizedProfitOfA -
            customData.balancingModifierForProfitProgress.progress * normalizedProgressOfA -
            (customData.balancingModifierForProfitProgress.profit * normalizedProfitOfB -
              customData.balancingModifierForProfitProgress.progress * normalizedProgressOfB)
          );
        }
        throw new Error(`Invalid sort type: ${sortType}`);
      };
    default:
      throw new Error(`Invalid benchmark type`);
  }
}

export function optimizeStorageAndFactory(
  industryData: CorpIndustryData,
  currentSmartStorageLevel: number,
  currentWarehouseLevel: number,
  currentSmartFactoriesLevel: number,
  divisionResearches: DivisionResearches,
  maxCost: number,
  enableLogging = false,
  boostMaterialTotalSizeRatio = 0.8,
): StorageFactoryBenchmarkData[] {
  if (currentSmartStorageLevel < 0 || currentWarehouseLevel < 0 || currentSmartFactoriesLevel < 0) {
    throw new Error('Invalid parameter');
  }
  // const logger = new Logger(enableLogging);
  const maxSmartStorageLevel = getMaxAffordableUpgradeLevel(
    UpgradeName.SMART_STORAGE,
    currentSmartStorageLevel,
    maxCost,
  );
  const maxWarehouseLevel = getMaxAffordableWarehouseLevel(currentWarehouseLevel, maxCost / 6);
  const comparator = getComparator(BenchmarkType.STORAGE_FACTORY);
  const priorityQueue = new PriorityQueue(comparator);
  let minSmartStorageLevel = currentSmartStorageLevel;
  if (maxSmartStorageLevel - minSmartStorageLevel > 1000) {
    minSmartStorageLevel = maxSmartStorageLevel - 1000;
  }
  let minWarehouseLevel = currentWarehouseLevel;
  if (maxWarehouseLevel - minWarehouseLevel > 1000) {
    minWarehouseLevel = maxWarehouseLevel - 1000;
  }
  // logger.log(`minSmartStorageLevel: ${minSmartStorageLevel}`);
  // logger.log(`minWarehouseLevel: ${minWarehouseLevel}`);
  // logger.log(`maxSmartStorageLevel: ${maxSmartStorageLevel}`);
  // logger.log(`maxWarehouseLevel: ${maxWarehouseLevel}`);
  // logger.time('StorageAndFactory benchmark');
  for (let smartStorageLevel = minSmartStorageLevel; smartStorageLevel <= maxSmartStorageLevel; smartStorageLevel++) {
    const upgradeSmartStorageCost = getUpgradeCost(
      UpgradeName.SMART_STORAGE,
      currentSmartStorageLevel,
      smartStorageLevel,
    );
    for (let warehouseLevel = minWarehouseLevel; warehouseLevel <= maxWarehouseLevel; warehouseLevel++) {
      const upgradeWarehouseCost = getUpgradeWarehouseCost(currentWarehouseLevel, warehouseLevel) * 6;
      if (upgradeSmartStorageCost + upgradeWarehouseCost > maxCost) {
        break;
      }
      const warehouseSize = getWarehouseSize(smartStorageLevel, warehouseLevel, divisionResearches);
      const boostMaterials = getOptimalBoostMaterialQuantities(
        industryData,
        warehouseSize * boostMaterialTotalSizeRatio,
      );
      const boostMaterialMultiplier = getDivisionProductionMultiplier(industryData, boostMaterials);
      const budgetForSmartFactoriesUpgrade = maxCost - (upgradeSmartStorageCost + upgradeWarehouseCost);
      const maxAffordableSmartFactoriesLevel = getMaxAffordableUpgradeLevel(
        UpgradeName.SMART_FACTORIES,
        currentSmartFactoriesLevel,
        budgetForSmartFactoriesUpgrade,
      );
      const upgradeSmartFactoriesCost = getUpgradeCost(
        UpgradeName.SMART_FACTORIES,
        currentSmartFactoriesLevel,
        maxAffordableSmartFactoriesLevel,
      );
      const totalCost = upgradeSmartStorageCost + upgradeWarehouseCost + upgradeSmartFactoriesCost;
      const smartFactoriesMultiplier =
        1 + CorpUpgradesData[UpgradeName.SMART_FACTORIES].benefit * maxAffordableSmartFactoriesLevel;
      const production = boostMaterialMultiplier * smartFactoriesMultiplier;
      const dataEntry = {
        smartStorageLevel: smartStorageLevel,
        warehouseLevel: warehouseLevel,
        smartFactoriesLevel: maxAffordableSmartFactoriesLevel,
        upgradeSmartStorageCost: upgradeSmartStorageCost,
        upgradeWarehouseCost: upgradeWarehouseCost,
        warehouseSize: warehouseSize,
        totalCost: totalCost,
        production: production,
        costPerProduction: totalCost / production,
        boostMaterials: boostMaterials,
        boostMaterialMultiplier: boostMaterialMultiplier,
      };
      if (priorityQueue.size() < defaultLengthOfBenchmarkDataArray) {
        priorityQueue.push(dataEntry);
      } else if (comparator(dataEntry, priorityQueue.front()) > 0) {
        priorityQueue.pop();
        priorityQueue.push(dataEntry);
      }
    }
  }
  // logger.timeEnd('StorageAndFactory benchmark');
  const data: StorageFactoryBenchmarkData[] = priorityQueue.toArray();
  // data.forEach((data) => {
  // logger.log(
  //   `{storage:${data.smartStorageLevel}, warehouse:${data.warehouseLevel}, factory:${data.smartFactoriesLevel}, ` +
  //   `totalCost:${formatNumber(data.totalCost)}, ` +
  //   `warehouseSize:${formatNumber(data.warehouseSize)}, ` +
  //   `production:${formatNumber(data.production)}, ` +
  //   `costPerProduction:${formatNumber(data.costPerProduction)}, ` +
  //   `boostMaterialMultiplier:${formatNumber(data.boostMaterialMultiplier)}, ` +
  //   `boostMaterials:${data.boostMaterials}}`,
  // );
  // });
  return data;
}
