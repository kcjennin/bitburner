const DISABLED_LOGS = [
  "scan",
  "run",
  "getServerRequiredHackingLevel",
  "getHackingLevel",
  "getServerNumPortsRequired",
  "fileExists",
  "hasRootAccess"
]

function buildServerGraph(ns: NS, start: string): Record<string, string[]> {
  let graph: Record<string, string[]> = {};
  let servers: string[] = [start];
  let idx: number = 0;

  while (idx < servers.length) {
    graph[servers[idx]] = ns.scan(servers[idx])
    for (const newServer of graph[servers[idx]]) {
      if (!servers.includes(newServer)) {
        servers.push(newServer);
      }
    }
    ++idx;
  }
  return graph;
}

function bfsPath(
  graph: Record<string, string[]>,
  start: string,
  goal: string
): string[] | null {
  const queue: string[] = [start];
  const visited = new Set<string>([start]);
  const parent: Record<string, string | null> = { [start]: null};

  while (queue.length > 0) {
    const node = queue.shift()!;
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

  return null;
}

function pathToCommands(path: string[]): string {
  return path.map((p) => `connect ${p}`).join(" ; ")
}

export function autocomplete(data: AutocompleteData) {
  return data.servers;
}

export async function main(ns: NS) {
  if (ns.args.length != 1) ns.exit();

  const start = ns.getServer().hostname;
  const graph = buildServerGraph(ns, start)
  const path = bfsPath(graph, start, ns.args[0].toString())
  if (path !== null) {
    navigator.clipboard.writeText(pathToCommands(path))
    ns.tprint("Copied!")
  } else {
    ns.tprint(`Failed to find a path from ${start} to ${ns.args[0]}`)
  }
}