/** @param {NS} ns
 *  @param {string} host
 */
function getAction(ns, host) {
  return ns.ps(host)[0]?.filename.replace("scripts/", "").replace(".js", "")
}

function validate(ns, action, target, host) {
  if (ns.getServer(host) == null) {
    ns.tprint(host + " does not exist. Exiting.")
    ns.exit()
  }

  if (ns.getServer(target) == null) {
    ns.tprint(target + " does not exist. Exiting.")
    ns.exit()
  }

  if (getAction(ns, host) == action) {
    ns.print(host + " is already executing action " + action)
    ns.exit()
  }
}


/** @param {NS} ns */
export async function main(ns) {
  var action = ns.args[0]
  var target = ns.args[1]
  var host = ns.args[2]

  if (host == null) {
    host = target
  }

  var script = ""
  switch (action) {
    case "hack":
      script = "/scripts/hack.js"
      break
    case "grow":
      script = "/scripts/grow.js"
      break
    case "weaken":
      script = "/scripts/weak.js"
      break
    default:
      ns.tprint("Script unrecognized. Exiting.")
      ns.exit()
  }

  validate(ns, action, target, host)

  ns.killall(host)
  ns.exec("/scripts/copy-scripts.js", "home", 1, host)
  let threads = parseInt(ns.getServerMaxRam(host) / ns.getScriptRam(script))
  if (threads == 0) {
    ns.print(host + " cannot run script. No RAM.")
    ns.exit()
  }

  let pid = ns.exec(script, host, threads, target)
  if (pid == 0) {
    await ns.sleep(500)
    ns.exec(script, host, threads, target)
  }

  ns.tprint(action, " executed on ", host, " for ", target, " with ", threads, " threads.")
}