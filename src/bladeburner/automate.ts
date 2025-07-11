import { BladeburnerActionName, BladeburnerActionType, NS } from '@ns';

export async function main(ns: NS): Promise<void> {
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

  let staminaState = 'low';
  while (true) {
    const [staminaCurrent, staminaMax] = ns.bladeburner.getStamina();
    if (staminaState === 'high' && staminaCurrent <= staminaMax * 0.2) {
      staminaState = 'low';
    } else if (staminaState === 'low' && staminaCurrent > staminaMax * 0.6) {
      staminaState = 'high';
    }
    const actionType = staminaState === 'low' ? types[0] : types[1];
    const actionName = staminaState === 'low' ? low : high;

    if (!ns.bladeburner.startAction(actionType, actionName)) {
      throw new Error(
        `Failed to start action: ${actionType} ${actionName} ${ns.formatNumber(staminaCurrent)}/${ns.formatNumber(
          staminaMax,
        )}`,
      );
    }
    await ns.sleep(ns.bladeburner.getActionTime(actionType, actionName));
  }
}
