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
const BATCH_DELAY = 20;

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

/** 
 * @param {NS} ns
 * @param {string} target
 * @param {number} totalThreads
 * @return {Promise<[number, number, number, number]>}
 */
async function getThreadsHWGW(ns, target, totalThreads) {
  ns.clearPort(PORT);
  let hwgwPid = ns.exec("/hacking/hwgw-analyze.js", target, 1, totalThreads, PORT);

  let count = 100, result;
  while (count > 0) {
    result = ns.readPort(PORT);
    if (result !== "NULL PORT DATA") break;
    --count;
    await ns.sleep(20);
  }

  if (result === "NULL PORT DATA" || result === "NO SOLUTION") {
    return [0, 0, 0, 0]
  } else {
    return result
  }
}

function securityNotOK(ns, target) {
  return ns.getServerSecurityLevel(target) > ns.getServerMinSecurityLevel(target);
}

function moneyNotOK(ns, target) {
  return ns.getServerMoneyAvailable(target) < ns.getServerMaxMoney(target);
}

export function autocomplete(data) {
  return data.servers;
}

/** @param {NS} ns */
export async function main(ns) {
  DISABLED_LOGS.forEach(ns.disableLog);
  if (ns.args.length !== 1) return;
  const target = ns.args[0];

  while (true) {
    let totalRam = ns.getServer().maxRam - 64;
    if (totalRam <= 0) return;

    const totalThreads = Math.floor(totalRam / SCRIPT_RAM);

    while (securityNotOK(ns, target)) {
      ns.print("Weakening");
      ns.run("/scripts/weak.js", totalThreads, target);
      await ns.sleep(Math.max(ns.getWeakenTime(target) + 200, 20));
    }

    ns.scp("/hacking/gw-analyze.js", target);
    while (moneyNotOK(ns, target)) {
      ns.print("Growing");
      const [g, w] = await getThreadsGW(ns, target, totalThreads);
      const gTime = ns.getGrowTime(target), wTime = ns.getWeakenTime(target);

      if (g === 0) {
        ns.print("getThreadsGW() failed.");
        ns.exit();
      }

      ns.run("/scripts/grow.js", g, target, JSON.stringify({ additionalMsec: wTime - gTime - 100 }));
      ns.run("/scripts/weak.js", w, target);
      await ns.sleep(Math.max(wTime + 1000, 20));
    }

    ns.scp("/hacking/hwgw-analyze.js", target);
    while (!securityNotOK(ns, target) && !moneyNotOK(ns, target)) {
      ns.print("Hacking");

      const hTime = ns.getHackTime(target),
            gTime = ns.getGrowTime(target),
            wTime = ns.getWeakenTime(target);

      let batchThreads = totalThreads;
      let [h, w1, g, w2] = await getThreadsHWGW(ns, target, totalThreads);

      if (h === 0) {
        ns.print("getThreadsHWGW() failed.");
        ns.exit();
      }

      const hwgw = h + w1 + g + w2;
      while ((batchThreads - hwgw) > 0) {
        ns.run("/scripts/hack.js", h, target, JSON.stringify({ additionalMsec: wTime - hTime - 200 }));
        ns.run("/scripts/weak.js", w1, target, JSON.stringify({ additionalMsec: 0 }));
        ns.run("/scripts/grow.js", g, target, JSON.stringify({ additionalMsec: wTime - gTime - 200 + 1000 }));
        ns.run("/scripts/weak.js", w2, target, JSON.stringify({ additionalMsec: 1000 }));

        batchThreads -= hwgw;
        await ns.sleep(100);
      }

      await ns.sleep(Math.max(wTime + 2000, 20));
    }

    await ns.sleep(100);
  }
}
