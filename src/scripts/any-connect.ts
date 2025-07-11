import { connectPath } from '@/lib/utils';
import { AutocompleteData, NS } from '@ns';

function pathToCommands(path: string[]): string {
  return path.map((p) => `connect ${p}`).join(' ; ');
}

export function autocomplete(data: AutocompleteData) {
  return data.servers;
}

export async function main(ns: NS) {
  const target = ns.args[0];
  if (typeof target !== 'string') {
    ns.tprint('usage: ac <target>');
    return;
  }

  const start = ns.getHostname();
  const path = connectPath(ns, start, target);
  await navigator.clipboard.writeText(pathToCommands(path));
  ns.tprint('Copied!');
}
