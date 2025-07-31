import { NS } from '@ns';
import { Deque } from '@/lib/Deque';
import { Job, JOB_TYPES, submitJob } from '@/hacking/lib/Job';
import { Target } from '@/hacking/lib/Target';
import { Expediter } from '@/hacking/lib/Expediter';

export class JITScheduler {
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

  async deploy(target: Target, ram: Expediter): Promise<boolean> {
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

    const types: string[] = [];
    const received: string[] = [];
    const receiveJob = async () => {
      const dataPort = this.ns.getPortHandle(this.ns.pid);
      if (dataPort.empty()) await dataPort.nextWrite();
      const { type, server, cost } = JSON.parse(dataPort.read());

      types.push(type);
      if (types.length === 5) types.shift();

      ram.free(cost, server);
      this.#running--;
      this.stopped++;
      switch (type) {
        case 'hack':
          received.push('hack');
          break;
        case 'weaken1':
          received.push('-weaken1');
          break;
        case 'grow':
          received.push('--grow');
          break;
        case 'weaken2':
          received.push('---weaken2');
          break;
      }
    };
    const outOfOrder = () => {
      return !types.every((t, i) => t === JOB_TYPES[i]);
    };

    // clear the first batch running (may have already been started)
    for (let _ = 0; _ < 4; ++_) {
      await receiveJob();
    }

    // receive jobs until we're resyncronized
    let needsResync = false;
    while (outOfOrder() && this.#running > 0) {
      await receiveJob();
      needsResync = true;
    }

    if (needsResync) {
      this.ns.write('/data/jit-output.txt', received.join('\n'), 'w');
      this.ns.exit();
    }
    return needsResync;
  }

  resync(): boolean {
    const job = this.hack.peekFront();
    if (job === undefined) return false;

    job.threads = 1;
    return true;
  }
}
