// apps/dashboard/ritual.ts

import { emit, listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { mountGlideField } from "./mountField";
import "./App";

const video = document.getElementById("ritual-video") as HTMLVideoElement;
const fieldLayer = document.getElementById("field-layer")!;
const ritualLayer = document.getElementById("ritual-layer")!;

video.src = "/ritual/glide-entrance.mp4";
video.preload = "auto";

// ─────────────────────────────
// 🎧 Audio Gate (minimal fix)
// ─────────────────────────────

let audioUnlocked = false;

function unlockAudio() {
  if (audioUnlocked) return;

  video.muted = false;
  audioUnlocked = true;

  console.log("[Glide] audio unlocked");
}

// 必须在用户手势中执行（关键）
document.addEventListener("pointerdown", unlockAudio, { once: true });
document.addEventListener("keydown", unlockAudio, { once: true });

// ─────────────────────────────
// 🎬 Timeline
// ─────────────────────────────

const timeline = [
  { at: 0.0, event: "presence:arise" },
  { at: 1.5, event: "event:field-born" },
  { at: 2.5, event: "skill:potential" },
  { at: 3.0, event: "world:discovered" },
  { at: 5.0, event: "causality:open" },
  { at: 7.0, event: "projection:enter" },
  { at: 9.0, event: "identity:belong" },
  { at: 10.0, event: "glide:become" },
];

let lastEvent = "";

video.ontimeupdate = () => {
  const t = video.currentTime;

  for (const m of timeline) {
    if (t >= m.at && lastEvent !== m.event) {
      lastEvent = m.event;
      emit(m.event);
    }
  }
};

// ─────────────────────────────
// 🎯 Event Hooks
// ─────────────────────────────

listen("projection:enter", () => {
  mountGlideField();
});

listen("portal:awaken", async () => {
  await invoke("show_window");

  mountGlideField();

  // ❗ CRITICAL FIX:
  // 不再在这里 play video
  // 只做“状态准备”
  if (!audioUnlocked) {
    console.warn("[Glide] portal triggered before audio unlock");
  }

  // 如果已经 unlock，再播放
  if (audioUnlocked) {
    video.play().catch((e) => {
      console.warn("[Glide] play blocked:", e);
    });
  }
});

listen("ritual:enter", () => {
  fieldLayer.classList.add("manifest");
});

// ─────────────────────────────
// 🧹 Cleanup
// ─────────────────────────────

video.onended = () => {
  ritualLayer.style.transition = "opacity 1s";
  ritualLayer.style.opacity = "0";

  setTimeout(() => ritualLayer.remove(), 1000);
};