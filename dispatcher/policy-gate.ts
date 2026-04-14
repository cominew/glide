// dispatcher/policy-gate.ts
// Policy Gate: Evaluates if an action is allowed based on the authority engine's decision. This is used by the dispatcher before executing any action. 

import { AuthorityEngine } from "../governance/authority-engine";

export function policyGate(engine: AuthorityEngine, action: string) {
  return engine.evaluate(action);
}