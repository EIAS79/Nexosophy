"use client";

import { useEffect } from "react";

export function HomeMotionController() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-home-root]");
    if (!root) return;

    root.style.setProperty("--page-progress", "1");

    for (const scene of root.querySelectorAll<HTMLElement>("[data-motion-scene]")) {
      scene.style.setProperty("--scene-progress", "0.5");
      scene.style.setProperty("--scene-focus", "1");
      scene.style.setProperty("--scene-lift", "0px");
      scene.style.setProperty("--scene-shift", "0px");
      scene.style.setProperty("--scene-float-a", "0px");
      scene.style.setProperty("--scene-float-b", "0px");
      scene.style.setProperty("--scene-float-c", "0px");
      scene.style.setProperty("--scene-scatter-left", "0px");
      scene.style.setProperty("--scene-scatter-right", "0px");
      scene.style.setProperty("--scene-line-offset", "0");
      scene.style.setProperty("--scene-orb-scale", "1");
      scene.style.setProperty("--scene-stage-lift", "0px");
      scene.style.setProperty("--scene-card-lift", "0px");
      scene.style.setProperty("--scene-card-opacity", "1");
      scene.style.setProperty("--scene-eco-x", "0px");
      scene.style.setProperty("--scene-eco-y", "0px");
      scene.style.setProperty("--scene-trust-x", "0px");
      scene.style.setProperty("--scene-trust-y", "0px");
      scene.dataset.motionState = "visible";
    }
  }, []);

  return null;
}
