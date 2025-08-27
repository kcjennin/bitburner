import { NS } from '@ns';

type JobType = 'h' | 'w1' | 'g' | 'w2';

export interface WorkerCommand {
  type: JobType;
  target: string;
  port?: number;
  time?: number;
  end?: number;
  stock?: boolean;
}

export interface WorkerStatus {
  type: JobType;
}

const JOB_SCRIPTS = {
  h: '/hacking/workers/hack.js',
  w1: '/hacking/workers/weaken.js',
  g: '/hacking/workers/grow.js',
  w2: '/hacking/workers/weaken.js',
} as const;

export const JOB_RAM = {
  h: 1.7,
  w1: 1.75,
  g: 1.75,
  w2: 1.75,
} as const;

const DEBUG = false;

export async function submitJob(
  ns: NS,
  host: string,
  threads: number,
  type: JobType,
  target: string,
  port?: number,
  time?: number,
  end?: number,
  stock?: boolean,
): Promise<number> {
  ns.scp(JOB_SCRIPTS[type], host, 'home');
  if (DEBUG) ns.write('/data/endTimes.txt', ns.formatNumber(end ?? 0, 0), 'a');

  const wi: WorkerCommand = {
    type,
    target,
    port,
    time,
    end,
    stock,
  };
  const pid = ns.exec(JOB_SCRIPTS[type], host, { threads, temporary: true }, JSON.stringify(wi));
  if (pid === 0) {
    throw 'Failed to submit job.';
  }

  const jobPort = ns.getPortHandle(pid);
  if (jobPort.empty()) await jobPort.nextWrite();
  const delay = jobPort.read() as number;
  return delay;
}

export async function collectJob(ns: NS): Promise<WorkerStatus> {
  const port = ns.getPortHandle(ns.pid);
  if (port.empty()) await port.nextWrite();
  return JSON.parse(port.read()) as WorkerStatus;
}
