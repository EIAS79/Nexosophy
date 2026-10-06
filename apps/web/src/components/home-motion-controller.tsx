"use client";

import { useEffect } from "react";

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const px = (value: number) => value.toFixed(2).concat("px");

export function HomeMotionController() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-home-root]");
    if (!root) return;

    const scenes = Array.from(root.querySelectorAll<HTMLElement>("[data-motion-scene]"));
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    let frame = 0;

    const updateScene = (scene: HTMLElement, progress: number, focus: number) => {
      const orbit = Math.sin(progress * Math.PI * 2);
      const lift = (1 - focus) * 28;
      const shift = (0.5 - progress) * 34;
      const scatter = (1 - focus) * 34;

      scene.style.setProperty("--scene-progress", progress.toFixed(4));
      scene.style.setProperty("--scene-focus", focus.toFixed(4));
      scene.style.setProperty("--scene-lift", px(lift));
      scene.style.setProperty("--scene-shift", px(shift));
      scene.style.setProperty("--scene-float-a", px(orbit * 12));
      scene.style.setProperty("--scene-float-b", px(-orbit * 10));
      scene.style.setProperty("--scene-float-c", px(orbit * 8));
      scene.style.setProperty("--scene-scatter-left", px(-scatter));
      scene.style.setProperty("--scene-scatter-right", px(scatter));
      scene.style.setProperty("--scene-line-offset", ((1 - progress) * 80).toFixed(2));
      scene.style.setProperty("--scene-orb-scale", (0.88 + focus * 0.12).toFixed(3));
      scene.style.setProperty("--scene-stage-lift", px((1 - focus) * 30));
      scene.style.setProperty("--scene-card-lift", px((1 - focus) * 34));
      scene.style.setProperty("--scene-card-opacity", (0.55 + focus * 0.45).toFixed(3));
      scene.style.setProperty("--scene-eco-x", px(shift * 0.55));
      scene.style.setProperty("--scene-eco-y", px((1 - focus) * 24));
      scene.style.setProperty("--scene-trust-x", px(shift * 0.65));
      scene.style.setProperty("--scene-trust-y", px((1 - focus) * 22));
      scene.dataset.motionState = progress > 0.035 && progress < 0.99 ? "visible" : "idle";
    };

    const update = () => {
      frame = 0;

      if (reducedMotion.matches) {
        root.style.setProperty("--page-progress", "1");
        for (const scene of scenes) updateScene(scene, 0.5, 1);
        return;
      }

      const viewportHeight = Math.max(window.innerHeight, 1);
      const documentHeight = Math.max(document.documentElement.scrollHeight - viewportHeight, 1);
      root.style.setProperty("--page-progress", String(clamp(window.scrollY / documentHeight)));

      for (const scene of scenes) {
        const rect = scene.getBoundingClientRect();
        const travel = viewportHeight + rect.height;
        const progress = clamp((viewportHeight - rect.top) / travel);
        const focus = clamp(1 - Math.abs(progress - 0.52) * 2.25);
        updateScene(scene, progress, focus);
      }
    };

    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    reducedMotion.addEventListener("change", schedule);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      reducedMotion.removeEventListener("change", schedule);
    };
  }, []);

  return null;
}