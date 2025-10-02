import { NS, ScriptArg, ToastVariant } from '@ns';

type RunFunction = (script: string, ...args: ScriptArg[]) => number;
type AliveFunction = (pid: number) => boolean;

export interface DodgeArgs {
  ns: NS;
  command: string;
  filename?: string;
  cRun?: RunFunction;
  alive?: AliveFunction;
  verbose?: boolean;
  retries?: number;
  retryDelay?: number;
}

function stringHash(s: string): number {
  let hash = 0;
  for (const c of s) {
    hash = (hash << 5) - hash + c.charCodeAt(0);
    hash |= 0;
  }
  return hash;
}

function dataFile(c: string): string {
  return `/tmp/${stringHash(c)}-data.txt`;
}

function commandFile(c: string): string {
  return `/tmp/${stringHash(c)}-command.js`;
}

function runFunction(ns: NS): RunFunction {
  return (script: string, ...args: ScriptArg[]) => ns.run(script, { temporary: true }, ...args);
}

function aliveFunction(ns: NS): AliveFunction {
  return (pid: number) => ns.isRunning(pid);
}

export function stringifyHelper(key: string, value: unknown) {
  if (value instanceof Map) {
    return {
      dataType: 'Map',
      value: Array.from(value.entries()),
    };
  } else if (typeof value === 'bigint') {
    return {
      dataType: 'BigInt',
      value: value.toString(),
    };
  } else {
    return value;
  }
}

export function parseReviver(key: string, value: unknown) {
  type MapStore = { dataType: string; value: [unknown, unknown][] };
  type BigIntStore = { dataType: string; value: string };

  if (typeof value === 'object' && value !== null) {
    if ((value as MapStore).dataType === 'Map') {
      return new Map((value as MapStore).value);
    }
    if ((value as BigIntStore).dataType === 'BigInt') {
      return BigInt((value as BigIntStore).value);
    }
  }

  return value;
}

export function runCommand(
  ns: NS,
  cRun: RunFunction,
  command: string,
  filename = commandFile(command),
  verbose = false,
  ...args: ScriptArg[]
) {
  const scriptCommand = verbose ? `const output = ${command}; ns.tprint(output)` : command;

  const script = `import { stringifyHelper } from 'lib/dodge';

    export async function main(ns) {
      try {
        ${scriptCommand};
      } catch (err) {
        ns.tprint(String(err));
        throw(err);
      }
    }`;

  if (ns.read(filename) !== script) {
    ns.write(filename, script, 'w');
  }

  return cRun(filename, ...args);
}

export async function waitProcess(ns: NS, alive: AliveFunction, pid: number, verbose = false) {
  for (let retries = 0; retries < 1000; ++retries) {
    if (!alive(pid)) break;
    if (verbose && retries % 100 === 0) {
      ns.print(`Waiting for pid ${pid} to complete... (${retries})`);
    }

    await ns.sleep(10);
  }

  if (alive(pid)) {
    const error = `run-command pid ${pid} is running much longer than expected. Max retries exceeded.`;
    ns.print(error);
    throw error;
  }
}

export async function dodge({
  ns,
  command,
  filename = dataFile(command),
  cRun = runFunction(ns),
  alive = aliveFunction(ns),
  verbose = false,
  retries = 5,
  retryDelay = 50,
}: DodgeArgs) {
  const commandToFile = `const result = JSON.stringify(${command}, stringifyHelper); if (ns.read("${filename}") !== result) ns.write("${filename}", result, 'w');`;

  while (retries-- > 0) {
    try {
      const pid = runCommand(ns, cRun, commandToFile);
      if (pid === 0) {
        throw `runCommand returned no pid. (Insufficient RAM, or bad command?) Destination: ${commandFile(
          commandToFile,
        )} Command: ${commandToFile}`;
      }
      await waitProcess(ns, alive, pid, verbose);
      if (verbose) {
        ns.print(`Process ${pid} is done. Reading the contents of ${filename}`);
      }

      const filedata = ns.read(filename);
      if (filedata === undefined) {
        throw `ns.read('${filename}') returned undefined.`;
      }
      if (filedata === '') {
        throw `The expected output of ${filename} is empty.`;
      }
      if (verbose) {
        ns.print(`Read the following data for command ${command}:\n${filedata}`);
      }

      return JSON.parse(filedata, parseReviver);
    } catch (error) {
      const errorLog = `dodge error (${retries} retries remaining): ${String(error)}`;
      const type = retries > 0 ? 'warning' : 'error';

      ns.print(`${type.toUpperCase()}: ${errorLog}`);
      ns.toast(errorLog, type.toLowerCase() as ToastVariant);

      if (retries > 0) {
        throw error;
      }

      await ns.sleep(retryDelay);
    }
  }
}
