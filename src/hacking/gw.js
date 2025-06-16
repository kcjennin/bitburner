const DISABLED_LOGS = [
  "clearPort",
  // "exec",
  "readPort",
  "sleep",
  "read",
  "getServerSecurityLevel",
  "getServerMinSecurityLevel",
  "getWeakenTime",
  "getServerMoneyAvailable",
  "getServerMaxMoney",
  "getGrowTime"
];

const SCRIPT_RAM = 1.75;
const PORT = 1;

/** 
 * @param {NS} ns
 * @param {string} target
 * @param {number} totalThreads
 * @return {Promise<[number, number]>}
 */
async function getThreadsGW(ns, target, totalThreads) {
  ns.clearPort(PORT);
  ns.exec("/hacking/gw-analyze.js", target, 1, totalThreads, PORT);

  let count = 1000;
  while (count > 0) {
    const result = ns.readPort(PORT);
    if (result !== "NULL PORT DATA") return result;
    --count;
    await ns.sleep(20);
  }

  return [0, 0]
}

export function autocomplete(data) {
  return data.servers;
}

/** @param {NS} ns */
export async function main(ns) {
  DISABLED_LOGS.forEach(ns.disableLog);
  if (ns.args.length !== 1) return;

  const target = ns.args[0];
  let totalRam = ns.getServer().maxRam - 64
  if (totalRam <= 0) return;

  const totalThreads = Math.floor(totalRam / SCRIPT_RAM);

  // Weaken server to minimum security
  while (ns.getServerSecurityLevel(target) > ns.getServerMinSecurityLevel(target)) {
    ns.print("Weakening");
    ns.run("/scripts/weak.js", totalThreads, target);
    await ns.sleep(ns.getWeakenTime(target) + 200);
  }

  // Grow server to maximum money
  ns.scp("/hacking/gw-analyze.js", target);
  while (true) {
    ns.print("Growing");
    const [g, w] = await getThreadsGW(ns, target, totalThreads);
    const gTime = ns.getGrowTime(target), wTime = ns.getWeakenTime(target);

    if (g === 0) {
      ns.print("getThreadsGW() failed.")
      ns.exit()
    }

    ns.run("/scripts/grow.js", g, target, JSON.stringify({ additionalMsec: wTime - gTime - 100 }));
    ns.run("/scripts/weak.js", w, target);
    await ns.sleep(wTime + 1000);
  }
}
