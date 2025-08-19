import { CityName, CorpMaterialName, CorpStateName, NS } from '@ns';

export const AGRI_NAME = 'Agriculture';
export const CHEM_NAME = 'Chemical';
export const TOBA_NAME = 'Tobacco';

export async function teaAndParty(ns: NS, divisionNames: string[], eps = 0.5) {
  const divisions = divisionNames.map(ns.corporation.getDivision);
  while (true) {
    let finished = true;

    for (const division of divisions) {
      for (const city of division.cities) {
        const office = ns.corporation.getOffice(division.name, city);
        if (office.avgEnergy < office.maxEnergy - eps) {
          ns.corporation.buyTea(division.name, city);
          finished = false;
        }
        if (office.avgMorale < office.maxMorale - eps) {
          ns.corporation.throwParty(division.name, city, 500000);
          finished = false;
        }
      }
    }

    if (finished) break;
    await waitState(ns, 'START');
  }
}

export async function waitState(ns: NS, state: CorpStateName) {
  while ((await ns.corporation.nextUpdate()) !== state);
}

function optimizeCorpoMaterials_raw(
  matSizes: number[],
  divWeights: number[],
  spaceConstraint: number,
  round: boolean,
): number[] {
  const p = divWeights.reduce((a, b) => a + b, 0);
  const w = matSizes.reduce((a, b) => a + b, 0);
  const r = [];
  for (let i = 0; i < matSizes.length; ++i) {
    let m =
      (spaceConstraint - 500 * ((matSizes[i] / divWeights[i]) * (p - divWeights[i]) - (w - matSizes[i]))) /
      (p / divWeights[i]) /
      matSizes[i];
    if (divWeights[i] <= 0 || m < 0) {
      return optimizeCorpoMaterials_raw(
        matSizes.toSpliced(i, 1),
        divWeights.toSpliced(i, 1),
        spaceConstraint,
        round,
      ).toSpliced(i, 0, 0);
    } else {
      if (round) m = Math.round(m);
      r.push(m);
    }
  }
  return r;
}

export function optimizeCorpoMaterials(ns: NS, divisionName: string, spaceConstraint: number, round = true) {
  const type = ns.corporation.getDivision(divisionName).type;
  const { aiCoreFactor, hardwareFactor, realEstateFactor, robotFactor } = ns.corporation.getIndustryData(type);
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const divWeights = [aiCoreFactor!, hardwareFactor!, realEstateFactor!, robotFactor!];
  const matSizes = ['AI Cores', 'Hardware', 'Real Estate', 'Robots'].map(
    (mat) => ns.corporation.getMaterialData(mat as CorpMaterialName).size,
  );
  return optimizeCorpoMaterials_raw(matSizes, divWeights, spaceConstraint, round);
}

export function loopAllDivisionsAndCities(ns: NS, callback: (divisionName: string, city: CityName) => void): void {
  for (const division of ns.corporation.getCorporation().divisions) {
    for (const city of Object.values(ns.enums.CityName)) {
      callback(division, city);
    }
  }
}
