//  governance/constitutional-violations.ts
// ─────────────────────────────────────────────────────────────
// Glide OS — Constitution Violations   
// ─────────────────────────────────────────────────────────────
// Layer: GOVERNANCE (enforces rules, never observes or executes)       
// Constitution v2 Compliance:
//   - Never awakens on its own, never subscribes to events.
//   - Only acts when explicitly invoked by other layers (e.g. Guardian, ConsciousLoop).
//   - Enforces the rules of the constitution, but does not monitor or report on them.
// ─────────────────────────────────────────────────────────────    

export enum ConstitutionalViolation {

  CONTINUOUS_COGNITION =
    'continuous-cognition-detected',

  CLOCK_DRIVEN_THINKING =
    'scheduler-triggered-cognition',

  NON_SEMANTIC_EVENT =
    'non-semantic-event-emitted',

  STRING_EVENT_EMIT =
    'string-literal-event',

  UI_NOISE_STREAM =
    'non-reasoning-event-exposed',

}

export interface ViolationRecord {
  type: ConstitutionalViolation;
  details: string;
  observedAt: number;
}   

