// governance/authority.types.ts
// -----------------------------------------------------------------------------------------------------------------------
// This file defines types related to the authority system used in the governance module.
// The authority system is responsible for making decisions about whether certain actions are allowed, denied, or require approval based on the context of the request.
// The AuthorityDecision type represents the possible outcomes of an authority check, which can be "ALLOW", "DENY", or "REQUIRES_APPROVAL".
// The AuthorityResult interface represents the result of an authority check, including the decision and an optional reason for the decision.
// The AuthorityContext interface represents the context of an authority check, including the actor making the request, the action being requested, the resource being accessed, and an optional risk level associated with the request.
// This file is used by the governance module to define the types for the authority system, which can be implemented by different authority providers to enforce access control and decision-making in the governance process.
// -----------------------------------------------------------------------------------------------------------------------

export type AuthorityDecision =
  | "ALLOW"
  | "DENY"
  | "REQUIRES_APPROVAL";

export interface AuthorityResult {
  decision: AuthorityDecision;
  reason?: string;
}

export interface AuthorityContext {
  actor: string;
  action: string;
  resource?: string;
  riskLevel?: number;
}