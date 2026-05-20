// apps/dashboard/interaction.ts
// ══════════════════════════════════════════════════════════
//   Interaction Machine · 用户交互状态机   
//   定义用户与小蜜的交互状态机，跟踪用户当前的交互阶段
//   通过监听事件驱动状态转换，并将当前状态广播给整个系统
// ══════════════════════════════════════════════════════════   
import { field } from "./field";

export type InteractionState = "absent" | "aware" | "hovering" | "engaged" | "conversing";

interface GlideEvent {
  type: string;
  payload?: any;
}   

class InteractionMachine {

  state: InteractionState = "absent";

  transition(event: GlideEvent) {

    switch(this.state) {

      case "absent":
        if (event.type === "presence:shift")
          this.enter("aware");
        break;

      case "aware":
        if (event.type === "cursor.enter")
          this.enter("hovering");
        break;

      case "hovering":
        if (event.type === "guide.click")
          this.enter("engaged");
        break;

      case "engaged":
        if (event.type === "chat.open")
          this.enter("conversing");
        break;
    }
  }

  enter(next: InteractionState) {
    this.state = next;
    field.emit("interaction.changed",{state:next});
  }
}