import { GangGenInfo, GangMemberInfo, NS } from '@ns';

const MIN_MEMBERS = 6;
const MAX_MEMBERS = 12;
const TRAIN_CHANCE = 0.2;

class Member {
  private readonly ns: NS;
  readonly name: string;
  task: string;
  info: GangMemberInfo;
  updated: boolean;

  constructor(ns: NS, name: string, task = 'Unassigned') {
    this.ns = ns;
    this.name = name;
    this.task = task;
    ns.gang.setMemberTask(name, task);
    this.info = ns.gang.getMemberInformation(name);
    this.updated = true;
  }

  update() {
    this.info = this.ns.gang.getMemberInformation(this.name);
    this.updated = true;
  }

  statSum(): number {
    return this.info.str + this.info.def + this.info.dex + this.info.agi;
  }

  setTask(task: string, statThreshold: number, bigGang: boolean, minStats = 200) {
    const statSum = this.statSum();
    if (statSum < minStats || (bigGang && statSum < statThreshold)) task = 'Train Combat';
    if (task !== this.task) {
      this.task = task;
      this.ns.gang.setMemberTask(this.name, task);
    }
  }
}

class Gang {
  readonly ns: NS;
  members: Member[];
  info: GangGenInfo;
  goal: 'train' | 'vigil' | 'start' | 'respect' | 'money' | 'warfare' | null;
  bestStats: number;

  constructor(ns: NS) {
    this.ns = ns;
    this.members = [];
    this.info = ns.gang.getGangInformation();
    this.goal = null;
    this.bestStats = 0;
  }

  update() {
    this.bestStats = 0;

    // Mark all as un-updated
    this.members.values().forEach((member) => {
      member.updated = false;
    });

    // Go through current members and update/add them
    for (const member of this.ns.gang.getMemberNames()) {
      let m = this.members.find((m) => m.name === member);
      if (m) m.update();
      else {
        m = new Member(this.ns, member);
        this.members.push(m);
      }

      this.bestStats = Math.max(this.bestStats, m.statSum());
    }

    const removed = this.members.filter((member) => !member.updated);
    for (const member of removed) {
      const idx = this.members.indexOf(member);
      this.members.splice(idx);
    }

    this.info = this.ns.gang.getGangInformation();
  }

  ascensions(multiplier = 10) {
    for (const member of this.members) {
      const r = this.ns.gang.getAscensionResult(member.name);
      if (!r) continue;
      const mpl = r.str * r.def * r.dex * r.agi;
      if (mpl > multiplier) {
        this.ns.gang.ascendMember(member.name);
      }
    }
  }

  equipment(afford = this.members.length) {
    let money = this.ns.getServerMoneyAvailable('home');
    for (const equip of this.ns.gang.getEquipmentNames()) {
      const cost = this.ns.gang.getEquipmentCost(equip);
      if (money / cost > afford) {
        this.members.forEach((member) => {
          if (!member.info.upgrades.includes(equip) && !member.info.augmentations.includes(equip)) {
            if (this.ns.gang.purchaseEquipment(member.name, equip)) {
              money -= cost;
            }
          }
        });
      }
    }
  }

  setGoal(respect = 2e6, warfare = 2, penalty = 0.99) {
    let maxOtherPower = 0;
    const otherInfos = this.ns.gang.getOtherGangInformation();
    for (const other in otherInfos) {
      if (other === this.info.faction) continue;
      maxOtherPower = Math.max(otherInfos[other].power, maxOtherPower);
    }

    const powerful = this.info.power > maxOtherPower * warfare;
    this.ns.gang.setTerritoryWarfare(powerful);

    if (this.members.length < MAX_MEMBERS) {
      // Fill members first
      this.goal = this.members.length < MIN_MEMBERS ? 'start' : 'respect';
    } else {
      if (this.info.wantedLevel > 2 && this.info.wantedPenalty < penalty) {
        this.goal = 'vigil';
      } else if (this.info.respect < respect) {
        // Then fill respect
        this.goal = 'respect';
      } else if (!powerful) {
        // Then power
        this.goal = 'warfare';
      } else {
        // Then money
        this.goal = 'money';
      }
    }
  }

  setTasks(statBound = 0.7) {
    const statThreshold = this.bestStats * statBound;
    const taskSet = (member: Member, task: string) =>
      member.setTask(task, statThreshold, this.members.length > MIN_MEMBERS);
    for (const member of this.members) {
      // Chance to choose training instead of the normal action
      const goal = Math.random() <= TRAIN_CHANCE ? 'train' : this.goal;
      switch (goal) {
        case 'train':
          taskSet(member, 'Train Combat');
          break;
        case 'vigil':
          taskSet(member, 'Vigilante Justice');
          break;
        case 'start':
          taskSet(member, 'Mug People');
          break;
        case 'respect':
          taskSet(member, 'Terrorism');
          break;
        case 'money':
          taskSet(member, 'Human Trafficking');
          break;
        case 'warfare':
          taskSet(member, 'Territory Warfare');
          break;
      }
    }
  }

  numMembers() {
    return this.members.length;
  }
}

export async function main(ns: NS): Promise<void> {
  ns.disableLog('ALL');
  ns.ui.openTail();

  while (true) {
    const gang = new Gang(ns);
    gang.update();

    if (ns.gang.canRecruitMember()) {
      ns.gang.recruitMember(`member-${Math.random().toString().substring(2, 4)}`);
    }

    gang.ascensions();

    gang.equipment();

    gang.setGoal();

    gang.setTasks();

    const timer = setInterval(() => {
      ns.clearLog();
      ns.print(`Goal: ${gang.goal}`);
      ns.print(`Respect: ${ns.formatNumber(gang.info.respect)}`);
      ns.print(`Best Stats: ${gang.bestStats}`);
      ns.print(`Power: ${ns.formatNumber(gang.info.power)}`);
      ns.print(`Territory: ${ns.formatPercent(gang.info.territory)}`);
      ns.print(`Clash: ${ns.formatPercent(gang.info.territoryClashChance)}`);
    }, 1000);
    ns.atExit(() => clearInterval(timer));

    await ns.gang.nextUpdate();
    clearInterval(timer);
  }
}
