import { BladeburnerActionName, BladeburnerActionType, NS } from '@ns';

export async function main(ns: NS): Promise<void> {
  ns.disableLog('ALL');
  ns.ui.openTail();

  const low = ns.args[0] as BladeburnerActionName;
  const high = ns.args[1] as BladeburnerActionName;
  const types: BladeburnerActionType[] = [];

  const general = ns.bladeburner.getGeneralActionNames().map(String);
  const contracts = ns.bladeburner.getContractNames().map(String);
  const operations = ns.bladeburner.getOperationNames().map(String);
  for (const action of [low, high]) {
    if (general.includes(action)) {
      types.push('General' as BladeburnerActionType);
    } else if (contracts.includes(action)) {
      types.push('Contracts' as BladeburnerActionType);
    } else if (operations.includes(action)) {
      types.push('Operations' as BladeburnerActionType);
    } else {
      ns.tprint(`Invalid action: '${action}'`);
    }
  }

  let highStamina = false;
  while (true) {
    const [staminaCurrent, staminaMax] = ns.bladeburner.getStamina();

    if (staminaMax < 20) {
      ns.bladeburner.startAction('General', 'Training');
      await ns.sleep(ns.bladeburner.getActionTime('General', 'Training'));
      continue;
    }

    if (highStamina && staminaCurrent <= staminaMax * 0.5) {
      highStamina = false;
    } else if (!highStamina && staminaCurrent > staminaMax * 0.9) {
      highStamina = true;
    }
    const actionType = highStamina ? types[1] : types[0];
    const actionName = highStamina ? high : low;

    if (!ns.bladeburner.startAction(actionType, actionName)) {
      throw new Error(
        `Failed to start action: ${actionType} ${actionName} ${ns.formatNumber(staminaCurrent)}/${ns.formatNumber(
          staminaMax,
        )}`,
      );
    }
    ns.clearLog();
    ns.print(
      `Stamina: ${highStamina ? 'HIGH' : 'LOW'} ${ns.formatNumber(staminaCurrent)} / ${ns.formatNumber(staminaMax)}`,
    );
    ns.print(`Action: ${actionType} - ${actionName}`);
    await ns.sleep(ns.bladeburner.getActionTime(actionType, actionName));
  }
}
