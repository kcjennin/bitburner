/** @param {NS} ns */
export async function main(ns) {
  if (ns.args.length === 0) return;

  for (const target of ns.getPurchasedServers()) {
    const [mainScript, otherScripts, ...additional] = ns.args;

    // copy files
    ns.scp(mainScript, target);
    ns.scp(otherScripts.split(","), target);

    // run the script
    ns.exec(mainScript, target, 1, ...additional);

    // loop delay
    await ns.sleep(20);
  }
}