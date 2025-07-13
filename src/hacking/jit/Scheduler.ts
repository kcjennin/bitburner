import { NS } from '@ns';
import { Deque } from '@/lib/Deque';
import { Job, submitJob } from '@/hacking/jit/Job';
import { Target } from '@/hacking/jit/Target';

export class Scheduler {
  hack: Deque<Job>;
  weaken1: Deque<Job>;
  grow: Deque<Job>;
  weaken2: Deque<Job>;

  constructor(private ns: NS) {
    this.hack = new Deque<Job>();
    this.weaken1 = new Deque<Job>();
    this.grow = new Deque<Job>();
    this.weaken2 = new Deque<Job>();
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
    return this.hack.size;
  }

  async deploy(target: Target) {
    const cutoff = this.weaken2.peekFront()?.end;
    this.ns.tprint(cutoff);
    if (cutoff === undefined) return;

    const getStart = (job: Job | undefined) => {
      if (job === undefined) return Infinity;
      return job.end - target.times[job.type];
    };

    const startAll = async (queue: Deque<Job>) => {
      while (getStart(queue.peekFront()) <= cutoff) {
        const job = queue.popFront() as Job;
        job.end += target.delay;
        target.delay += await submitJob(this.ns, job);
      }
    };

    await startAll(this.hack);
    await startAll(this.weaken1);
    await startAll(this.grow);
    await startAll(this.weaken2);

    const dataPort = this.ns.getPortHandle(this.ns.pid);
    await dataPort.nextWrite();
    dataPort.clear();
  }
}
