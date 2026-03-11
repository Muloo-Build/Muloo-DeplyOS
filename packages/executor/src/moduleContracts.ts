import type { ModuleExecutionContract } from "./contracts";
import { pipelinesModuleContract } from "./pipelinesModule";
import { propertiesModuleContract } from "./propertiesModule";

const contracts: ModuleExecutionContract[] = [
  propertiesModuleContract,
  pipelinesModuleContract
];

export const moduleExecutionContracts = contracts;

export function getModuleExecutionContract(
  moduleKey: string
): ModuleExecutionContract | undefined {
  return contracts.find(
    (contract) => contract.definition.moduleKey === moduleKey
  );
}
