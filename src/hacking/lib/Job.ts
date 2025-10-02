import { NS } from '@ns';
import { Target } from './Target';

export const JOB_TYPES = ['h', 'w1', 'g', 'w2'] as const;
type JobType = (typeof JOB_TYPES)[number];
const COSTS = { h: 1.7, w1: 1.75, g: 1.75, w2: 1.75 };

const OLD_SCRIPTS = {
  h: '/hacking/workers/tHack.js',
  w1: '/hacking/workers/tWeaken.js',
  g: '/hacking/workers/tGrow.js',
  w2: '/hacking/workers/tWeaken.js',
};

export class Job {
  server: string;
  target: string;
  threads: number;
  end: number;
  time: number;
  report: boolean;

  constructor(public type: JobType, target: Target) {
    target.end += target.spacer;

    this.server = 'none';
    this.target = target.name;
    this.threads = target.threads[type];
    this.end = target.end;
    this.time = target.times[type];
    this.report = true;
  }

  cost() {
    return COSTS[this.type] * this.threads;
  }

  script() {
    return OLD_SCRIPTS[this.type];
  }
}

export async function submitJob(ns: NS, job: Job): Promise<number> {
  const pid = ns.exec(job.script(), job.server, { threads: job.threads, temporary: true }, ns.pid, JSON.stringify(job));

  if (pid === 0) {
    const server = ns.getServer(job.server);
    ns.print(`INFO: ${ns.formatNumber(server.maxRam - server.ramUsed)}/${ns.formatNumber(server.maxRam)}`);
    ns.print(job);
    throw 'Failed to execute job.';
  }

  const port = ns.getPortHandle(pid);
  await port.nextWrite();
  return port.read();
}
