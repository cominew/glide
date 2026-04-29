// apps/dashboard/ritual.ts

import { emit, listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";

// ✅ 引入 App，但不手动挂载，只触发模块加载
import "./App";

const video = document.getElementById("ritual-video") as HTMLVideoElement;
const fieldLayer = document.getElementById("field-layer")!;
const ritualLayer = document.getElementById("ritual-layer")!;

video.src = "/ritual/glide-entrance.mp4";

const timeline = [
  { at: 0.0, event: "ritual:begin" },
  { at: 1.5, event: "ritual:glide" },
  { at: 3.0, event: "ritual:discover" },
  { at: 6.0, event: "ritual:open" },
  { at: 8.0, event: "ritual:enter" },
  { at: 10.0, event: "ritual:field-emerge" },
];

let lastEvent = "";
video.ontimeupdate = () => {
  const t = video.currentTime;
  for (const m of timeline) {
    if (t >= m.at && lastEvent !== m.event) {
      lastEvent = m.event;
      emit(m.event, {});
    }
  }
};

listen("portal:awaken", async () => {
  await invoke("show_window");
  video.play();
  setTimeout(() => emit("projection:trigger", {}), 100);
});

listen("ritual:enter", () => {
  fieldLayer.classList.add("manifest");
});

video.onended = () => {
  ritualLayer.style.transition = "opacity 1s";
  ritualLayer.style.opacity = "0";
  setTimeout(() => ritualLayer.remove(), 1000);
};

