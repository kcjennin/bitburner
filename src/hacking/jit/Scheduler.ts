import { NS } from '@ns';
import { Deque } from '@/lib/Deque';
import { Job, JOB_TYPES, submitJob } from '@/hacking/jit/Job';
import { Target } from '@/hacking/jit/Target';
import { Expediter } from './Expediter';

export class Scheduler {
  hack: Deque<Job>;
  weaken1: Deque<Job>;
  grow: Deque<Job>;
  weaken2: Deque<Job>;
  #running: number;
  started: number;
  stopped: number;

  constructor(private ns: NS) {
    this.hack = new Deque<Job>();
    this.weaken1 = new Deque<Job>();
    this.grow = new Deque<Job>();
    this.weaken2 = new Deque<Job>();
    this.#running = 0;
    this.started = 0;
    this.stopped = 0;
  }

  push(job: Job) {
    switch (job.type) {
      case 'hack':
        this.hack.pushBack(job);
        break;
      case 'weaken1':
        this.weaken1.pushBack(job);
        break;
      case 'grow':
        this.grow.pushBack(job);
        break;
      case 'weaken2':
        this.weaken2.pushBack(job);
        break;
    }
  }

  size(): number {
    const sizes = [this.hack.size, this.weaken1.size, this.grow.size, this.weaken2.size];
    return Math.ceil((sizes.reduce((sum, s) => sum + s, 0) + this.#running) / 4);
  }

  queued(): number {
    return [this.hack.size, this.weaken1.size, this.grow.size, this.weaken2.size].reduce((sum, s) => sum + s, 0);
  }

  get running(): number {
    return this.#running;
  }

  cutoff(): number | undefined {
    return this.weaken2.peekFront()?.end;
  }

  async deploy(target: Target, ram: Expediter) {
    const cutoff = this.cutoff();
    if (cutoff !== undefined) {
      const getStart = (job: Job | undefined) => {
        if (job === undefined) return Infinity;
        return job.end - target.times[job.type];
      };

      const startAll = async (queue: Deque<Job>) => {
        while (getStart(queue.peekFront()) <= cutoff) {
          const job = queue.popFront() as Job;
          job.end += target.delay;

          target.delay += await submitJob(this.ns, job);
          this.#running++;
          this.started++;
        }
      };

      await startAll(this.hack);
      await startAll(this.weaken1);
      await startAll(this.grow);
      await startAll(this.weaken2);
    }

    // clear the first batch running (may have already been started)
    const types = [];
    for (let _ = 0; _ < 4; ++_) {
      const dataPort = this.ns.getPortHandle(this.ns.pid);
      if (dataPort.empty()) await dataPort.nextWrite();
      const { type, server, cost } = JSON.parse(dataPort.read());
      types.push(type);
      ram.free(cost, server);
      this.#running--;
      this.stopped++;
    }

    if (target.delay > 0) this.ns.print(`WARN: Delay is non-zero: ${target.delay}`);
    if (!types.every((t, i) => t === JOB_TYPES[i])) this.ns.print('WARN: Out-of-order execution.');
  }

  async resync(ram: Expediter, timeout: number) {
    const clearQueue = (queue: Deque<Job>) => {
      while (queue.size > 0) {
        const job = queue.popFront() as Job;
        ram.free(job.cost(), job.server);
      }
    };
    clearQueue(this.hack);
    clearQueue(this.weaken1);
    clearQueue(this.grow);
    clearQueue(this.weaken2);

    const dataPort = this.ns.getPortHandle(this.ns.pid);
    // clear running jobs
    while (this.#running > 0 && Date.now() < timeout) {
      if (dataPort.empty()) await dataPort.nextWrite();
      const { server, cost } = JSON.parse(dataPort.read());
      ram.free(cost, server);
      this.#running--;
    }

    this.ns.print('WARN: Finished resync.');
    if (this.#running !== 0) this.ns.print(`WARN: Less jobs to cleanup than expected: ${this.#running}`);
    this.#running = 0;
    this.started = 0;
    this.stopped = 0;
  }
}
