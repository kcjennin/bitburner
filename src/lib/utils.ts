import { NS, ScriptArg } from '@ns';

export const WORKERS = ['/hacking/workers/tHack.js', '/hacking/workers/tWeaken.js', '/hacking/workers/tGrow.js'];
export const SCRIPTS = { hack: WORKERS[0], weaken1: WORKERS[1], grow: WORKERS[2], weaken2: WORKERS[1] };

export type Block = { server: string; ram: number };

export async function main(ns: NS): Promise<void> {
  ns.print('This is a library file.');
}

export function getServers(ns: NS) {
  const hosts = new Set(['home']);
  hosts.forEach((h) => {
    ns.scan(h).forEach((n) => hosts.add(n));
  });
  return Array.from(hosts);
}

/** Sorting function to get the best server for hacking. */
export function checkTarget(ns: NS, server: string, target = 'n00dles', forms = false): string {
  // if (!ns.hasRootAccess(server) || peekTarget(ns, server) !== ns.pid) {
  if (!ns.hasRootAccess(server)) {
    return target;
  }

  const player = ns.getPlayer();
  const serverSim = ns.getServer(server);
  const pSim = ns.getServer(target);

  let previousScore: number, currentScore: number;

  if ((serverSim.requiredHackingSkill ?? Infinity) <= player.skills.hacking / (forms ? 1 : 2)) {
    if (forms) {
      serverSim.hackDifficulty = serverSim.minDifficulty;
      pSim.hackDifficulty = pSim.minDifficulty;

      if (ns.formulas.hacking.weakenTime(serverSim, player) > 5 * 60 * 1000) {
        // don't want to run anything super long, may change later
        return target;
      }

      previousScore =
        ((pSim.moneyMax ?? 0) / ns.formulas.hacking.weakenTime(pSim, player)) *
        ns.formulas.hacking.hackTime(pSim, player);
      currentScore =
        ((serverSim.moneyMax ?? 0) / ns.formulas.hacking.weakenTime(serverSim, player)) *
        ns.formulas.hacking.hackTime(serverSim, player);
    } else {
      previousScore = (pSim.moneyMax ?? 0) / (pSim.minDifficulty ?? Infinity);
      currentScore = (serverSim.moneyMax ?? 0) / (serverSim.minDifficulty ?? Infinity);
    }

    if (currentScore > previousScore) {
      target = server;
    }
  }
  return target;
}

/** Copy over scripts which checking to make sure we have root access. */
export function copyScripts(ns: NS, server: string, scripts: string[], overwrite = false) {
  for (const script of scripts) {
    if ((!ns.fileExists(script, server) || overwrite) && ns.hasRootAccess(server)) {
      ns.scp(script, server);
    }
  }
}

/** Check that a server is at max money and min security. */
export function isPrepped(ns: NS, server: string): boolean {
  const eps = 0.0001;
  const maxMoney = ns.getServerMaxMoney(server);
  const money = ns.getServerMoneyAvailable(server);
  const minSec = ns.getServerMinSecurityLevel(server);
  const sec = ns.getServerSecurityLevel(server);
  const secFix = Math.abs(sec - minSec) < eps;
  return money === maxMoney && secFix;
}

function buildServerGraph(ns: NS, start: string): Record<string, string[]> {
  const graph: Record<string, string[]> = {};
  const servers: string[] = [start];
  let idx = 0;

  while (idx < servers.length) {
    graph[servers[idx]] = ns.scan(servers[idx]);
    for (const newServer of graph[servers[idx]]) {
      if (!servers.includes(newServer)) {
        servers.push(newServer);
      }
    }
    ++idx;
  }
  return graph;
}

function bfsPath(graph: Record<string, string[]>, start: string, goal: string): string[] {
  const queue: string[] = [start];
  const visited = new Set<string>([start]);
  const parent: Record<string, string | null> = { [start]: null };

  while (queue.length > 0) {
    const node = queue.shift();
    if (node === undefined) {
      continue; // Skip if node is undefined
    }
    if (node === goal) {
      const path: string[] = [];
      let current: string | null = goal;
      while (current !== null) {
        path.push(current);
        current = parent[current];
      }
      return path.reverse().slice(1);
    }

    for (const neighbor of graph[node]) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        parent[neighbor] = node;
        queue.push(neighbor);
      }
    }
  }

  throw new Error('Failed to find path to target.');
}

export function connectPath(ns: NS, start: string, target: string): string[] {
  if (start === 'home') {
    const path = [target];
    let last = target;

    while (last !== 'home') {
      last = ns.scan(last)[0];
      path.push(last);
    }

    return path.reverse().slice(1);
  } else {
    const graph = buildServerGraph(ns, start);
    return bfsPath(graph, start, target);
  }
}

export function tryRun(ns: NS, script: string, ...args: ScriptArg[]): number | undefined {
  if (!ns.isRunning(script, 'home', ...args)) {
    return ns.run(script, 1, ...args);
  }
  return undefined;
}

export function getRam(ns: NS): number {
  return ns.getServerMaxRam('home') - ns.getServerUsedRam('home');
}

/**
 * Parses and validates script flags using ns.flags(), enforcing type safety.
 */
export function parseFlags<T extends object, P extends string>(
  ns: NS,
  schema: [keyof T, T[keyof T]][],
  positionalKeys?: P[],
): T & { _: string[] } & Record<P, ScriptArg> {
  const flags = ns.flags(schema as [string, string | number | boolean | string[]][]) as unknown as T & { _: string[] };

  // Basic validation example (extend as needed)
  const printUsage = () => {
    const usage = [
      ...schema.map(([key, def]) =>
        typeof def === 'boolean' ? `[--${String(key)}]` : `[--${String(key)} <${typeof def}>]`,
      ),
      ...(positionalKeys ?? []).map((name) => `<${name}>`),
    ].join(' ');
    ns.tprint(`Usage: run ${ns.getScriptName()} ${usage}`);
    ns.exit();
  };

  const positionalMap = {} as Record<P, ScriptArg>;
  (positionalKeys ?? []).forEach((key, i) => {
    if (flags._[i] === undefined) printUsage();
    positionalMap[key] = flags._[i];
  });

  return Object.assign(flags, positionalMap);
}
