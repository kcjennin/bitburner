import { CompanyName, NS } from '@ns';

export async function main(ns: NS): Promise<void> {
  const po = ns.getPlayer();

  while (true) {
    for (const [company, job] of Object.entries(po.jobs)) {
      const field = ns.singularity.getCompanyPositionInfo(company as CompanyName, job).field;
      ns.singularity.applyToCompany(company as CompanyName, field);
    }

    await ns.sleep(10000);
  }
}
