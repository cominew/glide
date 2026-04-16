// kernel/graph/intent-extractor.ts

import { KernelEvent } from "../event-bus/event-bus";



export class IntentExtractor {

  extract(event: KernelEvent): string | null {

    if (event.type.startsWith("task")) {
      return "TASK_EXECUTION";
    }

    if (event.type.startsWith("conscious")) {
      return "REFLECTION";
    }

    if (event.type === "user.input") {
      return "USER_GOAL";
    }

    return null;
  }
}
