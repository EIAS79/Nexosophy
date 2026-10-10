"use client";

import type {
  ContentNode,
  SpatialDocument,
  SpatialElement,
  SpatialElementType,
  SpatialPoint,
} from "@nexosophy/contracts";
import { Button } from "@nexosophy/ui";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent,
} from "react";

import { useRealtimeRoom } from "./realtime-room";
import styles from "./spatial-canvas-editor.module.css";

type Tool =
  | "select"
  | "pan"
  | "text"
  | "pen"
  | "highlighter"
  | "eraser"
  | "lasso"
  | "shape"
  | "sticky"
  | "connector"
  | "frame"
  | "image"
  | "file"
  | "audio"
  | "link"
  | "embed";

type CanvasElement = Omit<
  SpatialElement,
  "workspaceId" | "nodeId" | "createdAt" | "updatedAt"
>;

type Viewport = { x: number; y: number; zoom: number };

const TOOL_LABELS: Array<[Tool, string]> = [
  ["select", "Select"],
  ["pan", "Pan"],
  ["text", "Text"],
  ["pen", "Pen"],
  ["highlighter", "Highlighter"],
  ["eraser", "Eraser"],
  ["lasso", "Lasso"],
  ["shape", "Shape"],
  ["sticky", "Sticky"],
  ["connector", "Connector"],
  ["frame", "Frame"],
  ["image", "Image"],
  ["file", "File"],
  ["audio", "Audio"],
  ["link", "Link"],
  ["embed", "Embed"],
];

function elementFromRecord(element: SpatialElement): CanvasElement {
  const {
    workspaceId: _workspaceId,
    nodeId: _nodeId,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...rest
  } = element;
  return rest;
}

function asCanvasElement(value: unknown): CanvasElement | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<CanvasElement>;
  if (
    typeof item.id !== "string" ||
    typeof item.type !== "string" ||
    typeof item.x !== "number" ||
    typeof item.y !== "number" ||
    typeof item.width !== "number" ||
    typeof item.height !== "number"
  ) {
    return null;
  }
  return {
    id: item.id,
    type: item.type as SpatialElementType,
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
    rotation: item.rotation ?? 0,
    zRank: item.zRank ?? 0,
    groupId: item.groupId ?? null,
    locked: item.locked ?? false,
    payload: item.payload ?? {},
    version: item.version ?? 1,
  };
}

function worldPoint(
  event: ReactPointerEvent<SVGSVGElement>,
  viewport: Viewport,
): { x: number; y: number } {
  const rect = event.currentTarget.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left - viewport.x) / viewport.zoom,
    y: (event.clientY - rect.top - viewport.y) / viewport.zoom,
  };
}

function pathFromPoints(points: SpatialPoint[]): string {
  if (points.length === 0) return "";
  return points
    .map((point, index) => (index === 0 ? "M" : "L") + point.x + " " + point.y)
    .join(" ");
}

function boundsFromPoints(points: SpatialPoint[]) {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

function elementIntersects(
  element: CanvasElement,
  rect: { x: number; y: number; width: number; height: number },
): boolean {
  return !(
    element.x + element.width < rect.x ||
    element.y + element.height < rect.y ||
    element.x > rect.x + rect.width ||
    element.y > rect.y + rect.height
  );
}

function elementToSvg(element: CanvasElement): string {
  const text = String(element.payload.text ?? "").replace(/[<>&"]/g, (value) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    '"': "&quot;",
  })[value] ?? value);
  if (element.type === "ink_stroke" || element.type === "highlighter_stroke") {
    const points = (element.payload.points ?? []) as SpatialPoint[];
    const d = pathFromPoints(points);
    const stroke =
      typeof element.payload.color === "string"
        ? element.payload.color
        : element.type === "highlighter_stroke"
          ? "#facc15"
          : "#111827";
    const opacity = element.type === "highlighter_stroke" ? "0.35" : "1";
    const width = Number(element.payload.strokeWidth ?? (element.type === "highlighter_stroke" ? 14 : 3));
    return `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}"/>`;
  }
  if (element.type === "text_region") {
    return `<foreignObject x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}"><div xmlns="http://www.w3.org/1999/xhtml" style="font:16px sans-serif;white-space:pre-wrap">${text}</div></foreignObject>`;
  }
  if (element.type === "sticky") {
    return `<g><rect x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}" rx="8" fill="#fef08a"/><text x="${element.x + 12}" y="${element.y + 28}" font-family="sans-serif" font-size="15">${text}</text></g>`;
  }
  if (element.type === "connector") {
    const x2 = Number(element.payload.x2 ?? element.x + element.width);
    const y2 = Number(element.payload.y2 ?? element.y + element.height);
    return `<line x1="${element.x}" y1="${element.y}" x2="${x2}" y2="${y2}" stroke="#64748b" stroke-width="2"/>`;
  }
  const fill =
    element.type === "frame"
      ? "none"
      : typeof element.payload.fill === "string"
        ? element.payload.fill
        : "#dbeafe";
  const dash = element.type === "frame" ? ' stroke-dasharray="8 6"' : "";
  return `<rect x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}" rx="8" fill="${fill}" stroke="#64748b"${dash}/>`;
}

export function SpatialCanvasEditor({
  workspaceId,
  node,
  initialDocument,
  initialElements,
}: {
  workspaceId: string;
  node: ContentNode;
  initialDocument: SpatialDocument;
  initialElements: SpatialElement[];
}) {
  const room = useRealtimeRoom();
  const [spatialDocument, setSpatialDocument] = useState(initialDocument);
  const [elements, setElements] = useState<Record<string, CanvasElement>>(() =>
    Object.fromEntries(initialElements.map((element) => [element.id, elementFromRecord(element)])),
  );
  const [tool, setTool] = useState<Tool>("select");
  const [selected, setSelected] = useState<string[]>([]);
  const [viewport, setViewport] = useState<Viewport>({ x: 40, y: 40, zoom: 1 });
  const [status, setStatus] = useState("");
  const [draftPoints, setDraftPoints] = useState<SpatialPoint[]>([]);
  const [lasso, setLasso] = useState<{ x: number; y: number; width: number; height: number } | null>(
    null,
  );
  const [drag, setDrag] = useState<{
    pointerId: number;
    startX: number;
    startY: number;
    originViewport?: Viewport;
    original?: Record<string, { x: number; y: number }>;
    mode: "pan" | "move" | "lasso" | "ink";
  } | null>(null);
  const activePointers = useRef(new Map<number, { x: number; y: number }>());
  const lamport = useRef(Date.now());
  const svgRef = useRef<SVGSVGElement>(null);
  const deviceKey = useRef("canvas");

  const sortedElements = useMemo(
    () => Object.values(elements).sort((a, b) => a.zRank - b.zRank || a.id.localeCompare(b.id)),
    [elements],
  );

  useEffect(() => {
    const incoming: Record<string, CanvasElement> = {};
    let settings: Record<string, unknown> | null = null;
    for (const [key, register] of Object.entries(room.registers)) {
      if (key === "canvas:settings" && !register.deleted && register.value && typeof register.value === "object") {
        settings = register.value as Record<string, unknown>;
        continue;
      }
      if (!key.startsWith("canvas:element:")) continue;
      const id = key.slice("canvas:element:".length);
      if (register.deleted) {
        incoming[id] = null as never;
        continue;
      }
      const parsed = asCanvasElement(register.value);
      if (parsed) incoming[id] = parsed;
    }
    if (Object.keys(incoming).length > 0) {
      setElements((current) => {
        const next = { ...current };
        for (const [id, element] of Object.entries(incoming)) {
          if (element) next[id] = element;
          else delete next[id];
        }
        return next;
      });
    }
    if (settings) {
      setSpatialDocument((current) => ({
        ...current,
        pageMode:
          settings.pageMode === "fixed" || settings.pageMode === "vertical"
            ? settings.pageMode
            : "infinite",
        backgroundKind:
          settings.backgroundKind === "grid" ||
          settings.backgroundKind === "ruled" ||
          settings.backgroundKind === "dot"
            ? settings.backgroundKind
            : "plain",
        paperSize: typeof settings.paperSize === "string" ? settings.paperSize : current.paperSize,
        orientation: settings.orientation === "landscape" ? "landscape" : "portrait",
        settings,
      }));
    }
  }, [room.registers]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetch(`/api/spatial/${workspaceId}/${node.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "viewport",
          originX: viewport.x,
          originY: viewport.y,
          zoom: viewport.zoom,
          deviceKey: deviceKey.current,
        }),
      });
    }, 500);
    room.sendPresence({
      viewport: { x: viewport.x, y: viewport.y, zoom: viewport.zoom },
      selection: { objectIds: selected },
    });
    return () => window.clearTimeout(timer);
  }, [node.id, room.sendPresence, selected, viewport, workspaceId]);

  const nextLamport = useCallback((): number => {
    lamport.current = Math.max(lamport.current + 1, Date.now());
    return lamport.current;
  }, []);

  const publishElement = useCallback((element: CanvasElement) => {
    setElements((current) => ({ ...current, [element.id]: element }));
    room.sendUpdate([
      {
        key: "canvas:element:" + element.id,
        value: element,
        deleted: false,
        lamport: nextLamport(),
      },
    ]);
  }, [nextLamport, room.sendUpdate]);

  function deleteElements(ids: string[]) {
    if (ids.length === 0) return;
    setElements((current) => {
      const next = { ...current };
      for (const id of ids) delete next[id];
      return next;
    });
    setSelected((current) => current.filter((id) => !ids.includes(id)));
    room.sendUpdate(
      ids.map((id) => ({
        key: "canvas:element:" + id,
        deleted: true,
        lamport: nextLamport(),
      })),
    );
  }

  function publishSettings(patch: Partial<SpatialDocument>) {
    const next = {
      ...spatialDocument.settings,
      pageMode: patch.pageMode ?? spatialDocument.pageMode,
      backgroundKind: patch.backgroundKind ?? spatialDocument.backgroundKind,
      paperSize: patch.paperSize ?? spatialDocument.paperSize,
      orientation: patch.orientation ?? spatialDocument.orientation,
    };
    setSpatialDocument((current) => ({
      ...current,
      pageMode: (next.pageMode as SpatialDocument["pageMode"]) ?? current.pageMode,
      backgroundKind:
        (next.backgroundKind as SpatialDocument["backgroundKind"]) ?? current.backgroundKind,
      paperSize: String(next.paperSize ?? current.paperSize),
      orientation:
        next.orientation === "landscape" ? "landscape" : "portrait",
      settings: next,
    }));
    room.sendUpdate([
      {
        key: "canvas:settings",
        value: next,
        deleted: false,
        lamport: nextLamport(),
      },
    ]);
  }

  function createElement(
    type: SpatialElementType,
    x: number,
    y: number,
    payload: Record<string, unknown> = {},
    width = 220,
    height = 140,
  ) {
    const element: CanvasElement = {
      id: crypto.randomUUID(),
      type,
      x,
      y,
      width,
      height,
      rotation: 0,
      zRank: (sortedElements.at(-1)?.zRank ?? 0) + 1024,
      groupId: null,
      locked: false,
      payload,
      version: 1,
    };
    publishElement(element);
    setSelected([element.id]);
    return element;
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const minX = (-viewport.x) / viewport.zoom - 300;
      const minY = (-viewport.y) / viewport.zoom - 300;
      const maxX = (rect.width - viewport.x) / viewport.zoom + 300;
      const maxY = (rect.height - viewport.y) / viewport.zoom + 300;

      void (async () => {
        let cursor: string | null = null;
        let pages = 0;
        do {
          const query = new URLSearchParams({
            minX: String(minX),
            minY: String(minY),
            maxX: String(maxX),
            maxY: String(maxY),
            limit: "500",
          });
          if (cursor) query.set("cursor", cursor);
          const response = await fetch(
            `/api/spatial/${workspaceId}/${node.id}?${query.toString()}`,
            { cache: "no-store" },
          );
          if (!response.ok) break;
          const payload = (await response.json()) as {
            elements: SpatialElement[];
            nextCursor: string | null;
          };
          setElements((current) => ({
            ...current,
            ...Object.fromEntries(
              payload.elements.map((element) => [element.id, elementFromRecord(element)]),
            ),
          }));
          cursor = payload.nextCursor;
          pages += 1;
        } while (cursor && pages < 6);
      })();
    }, 220);
    return () => window.clearTimeout(timer);
  }, [node.id, viewport.x, viewport.y, viewport.zoom, workspaceId]);

  function pointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    activePointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = worldPoint(event, viewport);

    if ((tool === "pen" || tool === "highlighter") && event.pointerType === "touch") {
      setDrag({
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originViewport: viewport,
        mode: "pan",
      });
      return;
    }

    if (tool === "pan" || (event.pointerType === "touch" && activePointers.current.size === 1)) {
      setDrag({
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originViewport: viewport,
        mode: "pan",
      });
      return;
    }

    if (tool === "pen" || tool === "highlighter") {
      setDraftPoints([
        {
          ...point,
          pressure: event.pressure || 0.5,
          tiltX: event.tiltX,
          tiltY: event.tiltY,
          time: performance.now(),
        },
      ]);
      setDrag({
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        mode: "ink",
      });
      return;
    }

    if (tool === "lasso") {
      setLasso({ x: point.x, y: point.y, width: 0, height: 0 });
      setDrag({
        pointerId: event.pointerId,
        startX: point.x,
        startY: point.y,
        mode: "lasso",
      });
      return;
    }

    if (tool === "text") {
      createElement("text_region", point.x, point.y, { text: "New text" }, 280, 120);
      return;
    }
    if (tool === "shape") {
      createElement("shape", point.x, point.y, { shape: "rectangle", fill: "#dbeafe" }, 180, 120);
      return;
    }
    if (tool === "sticky") {
      createElement("sticky", point.x, point.y, { text: "Sticky note" }, 180, 160);
      return;
    }
    if (tool === "frame") {
      createElement("frame", point.x, point.y, { label: "Frame" }, 500, 360);
      return;
    }
    if (tool === "image" || tool === "file" || tool === "audio") {
      const assetId = window.prompt("Paste an existing trusted asset ID from Files");
      if (assetId) {
        createElement(
          tool === "image" ? "image" : tool === "audio" ? "audio_anchor" : "file_attachment",
          point.x,
          point.y,
          {
            assetId,
            ...(tool === "audio" ? { offsetMs: 0 } : {}),
          },
          tool === "image" ? 320 : 260,
          tool === "image" ? 220 : 100,
        );
      }
      return;
    }
    if (tool === "link" || tool === "embed") {
      const url = window.prompt(tool === "link" ? "Paste a URL" : "Paste an embeddable URL");
      if (url) {
        try {
          const normalized = new URL(url).toString();
          createElement(
            tool === "link" ? "link_card" : "embed",
            point.x,
            point.y,
            { url: normalized },
            320,
            tool === "link" ? 120 : 220,
          );
        } catch {
          setStatus("That URL is invalid.");
        }
      }
      return;
    }
    if (tool === "connector") {
      if (selected.length !== 2) {
        setStatus("Select exactly two objects, then choose Connector.");
        return;
      }
      const from = elements[selected[0]!];
      const to = elements[selected[1]!];
      if (!from || !to) return;
      createElement(
        "connector",
        from.x + from.width / 2,
        from.y + from.height / 2,
        {
          fromId: from.id,
          toId: to.id,
          x2: to.x + to.width / 2,
          y2: to.y + to.height / 2,
        },
        Math.abs(to.x - from.x) || 1,
        Math.abs(to.y - from.y) || 1,
      );
    }
  }

  function pointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    const previousPointer = activePointers.current.get(event.pointerId);
    activePointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (activePointers.current.size >= 2) {
      const values = [...activePointers.current.values()];
      const a = values[0]!;
      const b = values[1]!;
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const previousDistance =
        previousPointer && values[1]
          ? Math.hypot(previousPointer.x - values[1].x, previousPointer.y - values[1].y)
          : distance;
      if (previousDistance > 0) {
        setViewport((current) => ({
          ...current,
          zoom: Math.min(4, Math.max(0.1, current.zoom * (distance / previousDistance))),
        }));
      }
      return;
    }

    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.mode === "pan" && drag.originViewport) {
      setViewport({
        ...drag.originViewport,
        x: drag.originViewport.x + (event.clientX - drag.startX),
        y: drag.originViewport.y + (event.clientY - drag.startY),
      });
      return;
    }
    const point = worldPoint(event, viewport);
    if (drag.mode === "ink") {
      setDraftPoints((current) => [
        ...current,
        {
          ...point,
          pressure: event.pressure || 0.5,
          tiltX: event.tiltX,
          tiltY: event.tiltY,
          time: performance.now(),
        },
      ]);
      return;
    }
    if (drag.mode === "lasso") {
      setLasso({
        x: Math.min(drag.startX, point.x),
        y: Math.min(drag.startY, point.y),
        width: Math.abs(point.x - drag.startX),
        height: Math.abs(point.y - drag.startY),
      });
    }
  }

  function pointerUp(event: ReactPointerEvent<SVGSVGElement>) {
    activePointers.current.delete(event.pointerId);
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.mode === "ink" && draftPoints.length > 1) {
      const bounds = boundsFromPoints(draftPoints);
      createElement(
        tool === "highlighter" ? "highlighter_stroke" : "ink_stroke",
        bounds.x,
        bounds.y,
        {
          points: draftPoints,
          color: tool === "highlighter" ? "#facc15" : "#111827",
          strokeWidth: tool === "highlighter" ? 14 : 3,
          pointerType: event.pointerType,
        },
        bounds.width,
        bounds.height,
      );
      setDraftPoints([]);
    }
    if (drag.mode === "lasso" && lasso) {
      setSelected(
        sortedElements.filter((element) => elementIntersects(element, lasso)).map((element) => element.id),
      );
      setLasso(null);
    }
    setDrag(null);
  }

  function onElementPointerDown(
    event: ReactPointerEvent<SVGGElement>,
    element: CanvasElement,
  ) {
    if (tool === "eraser") {
      event.stopPropagation();
      deleteElements([element.id]);
      return;
    }
    if (tool !== "select") return;
    event.stopPropagation();
    const isMulti = event.shiftKey || event.metaKey || event.ctrlKey;
    const nextSelection = isMulti
      ? selected.includes(element.id)
        ? selected.filter((id) => id !== element.id)
        : [...selected, element.id]
      : [element.id];
    setSelected(nextSelection);
    const originals = Object.fromEntries(
      nextSelection.flatMap((id) => {
        const item = elements[id];
        return item ? [[id, { x: item.x, y: item.y }]] : [];
      }),
    );
    setDrag({
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      original: originals,
      mode: "move",
    });
    (event.currentTarget.ownerSVGElement as SVGSVGElement | null)?.setPointerCapture(event.pointerId);
  }

  useEffect(() => {
    if (!drag || drag.mode !== "move") return;
    const move = (event: PointerEvent) => {
      if (event.pointerId !== drag.pointerId || !drag.original) return;
      const dx = (event.clientX - drag.startX) / viewport.zoom;
      const dy = (event.clientY - drag.startY) / viewport.zoom;
      setElements((current) => {
        const next = { ...current };
        for (const [id, origin] of Object.entries(drag.original ?? {})) {
          const item = next[id];
          if (item && !item.locked) next[id] = { ...item, x: origin.x + dx, y: origin.y + dy };
        }
        return next;
      });
    };
    const up = (event: PointerEvent) => {
      if (event.pointerId !== drag.pointerId || !drag.original) return;
      const dx = (event.clientX - drag.startX) / viewport.zoom;
      const dy = (event.clientY - drag.startY) / viewport.zoom;
      const updates: CanvasElement[] = [];
      for (const [id, origin] of Object.entries(drag.original)) {
        const item = elements[id];
        if (item && !item.locked) updates.push({ ...item, x: origin.x + dx, y: origin.y + dy });
      }
      for (const item of updates) publishElement(item);
      setDrag(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [drag, elements, viewport.zoom, publishElement]);

  function wheel(event: WheelEvent<SVGSVGElement>) {
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) {
      const factor = Math.exp(-event.deltaY * 0.002);
      setViewport((current) => ({
        ...current,
        zoom: Math.min(4, Math.max(0.1, current.zoom * factor)),
      }));
    } else {
      setViewport((current) => ({
        ...current,
        x: current.x - event.deltaX,
        y: current.y - event.deltaY,
      }));
    }
  }

  function groupSelected() {
    if (selected.length < 2) {
      setStatus("Select at least two objects to group.");
      return;
    }
    const groupId = crypto.randomUUID();
    const group = createElement("group", 0, 0, { childIds: selected }, 1, 1);
    const updates = selected.flatMap((id) => {
      const element = elements[id];
      if (!element) return [];
      const next = { ...element, groupId };
      setElements((current) => ({ ...current, [id]: next }));
      return [
        {
          key: "canvas:element:" + id,
          value: next,
          deleted: false,
          lamport: nextLamport(),
        },
      ];
    });
    room.sendUpdate([
      ...updates,
      {
        key: "canvas:element:" + group.id,
        value: { ...group, id: groupId },
        deleted: false,
        lamport: nextLamport(),
      },
    ]);
    setSelected(selected);
  }

  function applyTemplate(template: "blank" | "cornell" | "brainstorm") {
    if (template === "blank") {
      if (window.confirm("Clear all canvas objects?")) deleteElements(Object.keys(elements));
      return;
    }
    if (template === "cornell") {
      createElement("frame", 40, 40, { label: "Cornell notes" }, 760, 980);
      createElement("text_region", 60, 70, { text: "Cues / questions" }, 210, 760);
      createElement("text_region", 290, 70, { text: "Notes" }, 480, 760);
      createElement("text_region", 60, 850, { text: "Summary" }, 710, 130);
      return;
    }
    createElement("sticky", 360, 260, { text: "Main idea" }, 180, 140);
    for (const [x, y, text] of [
      [80, 80, "Idea A"],
      [650, 100, "Idea B"],
      [100, 520, "Idea C"],
      [650, 520, "Idea D"],
    ] as const) {
      createElement("sticky", x, y, { text }, 160, 120);
    }
  }

  function updateSelectedText(value: string) {
    const id = selected[0];
    const element = id ? elements[id] : null;
    if (!element || !["text_region", "sticky"].includes(element.type)) return;
    publishElement({ ...element, payload: { ...element.payload, text: value } });
  }

  async function exportCanvas(format: "svg" | "print") {
    await fetch(`/api/spatial/${workspaceId}/${node.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "export",
        format: format === "svg" ? "svg" : "print",
        scope: spatialDocument.pageMode === "fixed" ? "fixed-page" : "content",
      }),
    }).catch(() => undefined);

    if (format === "print") {
      window.print();
      return;
    }
    if (sortedElements.length === 0) return;
    const minX = Math.min(...sortedElements.map((element) => element.x));
    const minY = Math.min(...sortedElements.map((element) => element.y));
    const maxX = Math.max(...sortedElements.map((element) => element.x + element.width));
    const maxY = Math.max(...sortedElements.map((element) => element.y + element.height));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX - 20} ${minY - 20} ${maxX - minX + 40} ${maxY - minY + 40}">${sortedElements.map(elementToSvg).join("")}</svg>`;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = (node.name || "canvas") + ".svg";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const selectedElement = selected.length === 1 ? elements[selected[0]!] : null;
  const minimapBounds = useMemo(() => {
    if (sortedElements.length === 0) return { minX: 0, minY: 0, width: 1000, height: 800 };
    const minX = Math.min(...sortedElements.map((element) => element.x));
    const minY = Math.min(...sortedElements.map((element) => element.y));
    const maxX = Math.max(...sortedElements.map((element) => element.x + element.width));
    const maxY = Math.max(...sortedElements.map((element) => element.y + element.height));
    return { minX, minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
  }, [sortedElements]);

  return (
    <section className={styles.editor} data-mode={spatialDocument.pageMode}>
      <header className={styles.toolbar}>
        <div className={styles.tools} role="toolbar" aria-label="Canvas tools">
          {TOOL_LABELS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={tool === id}
              onClick={() => setTool(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className={styles.controls}>
          <label>
            Mode
            <select
              value={spatialDocument.pageMode}
              onChange={(event) =>
                publishSettings({ pageMode: event.currentTarget.value as SpatialDocument["pageMode"] })
              }
            >
              <option value="infinite">Infinite</option>
              <option value="vertical">Vertical</option>
              <option value="fixed">Fixed page</option>
            </select>
          </label>
          <label>
            Background
            <select
              value={spatialDocument.backgroundKind}
              onChange={(event) =>
                publishSettings({
                  backgroundKind: event.currentTarget.value as SpatialDocument["backgroundKind"],
                })
              }
            >
              <option value="plain">Plain</option>
              <option value="ruled">Ruled</option>
              <option value="grid">Grid</option>
              <option value="dot">Dot</option>
            </select>
          </label>
          <Button variant="secondary" onClick={groupSelected}>Group</Button>
          <Button variant="secondary" onClick={() => applyTemplate("cornell")}>Cornell</Button>
          <Button variant="secondary" onClick={() => applyTemplate("brainstorm")}>Brainstorm</Button>
          <Button variant="secondary" onClick={() => void exportCanvas("svg")}>Export SVG</Button>
          <Button variant="secondary" onClick={() => void exportCanvas("print")}>Print/PDF</Button>
        </div>
      </header>

      <div className={styles.statusbar}>
        <span>{room.status}</span>
        <span>{sortedElements.length} objects</span>
        <span>{Math.round(viewport.zoom * 100)}%</span>
        <span>{tool === "pen" || tool === "highlighter" ? "Stylus draws · touch pans/zooms" : "Shift/Ctrl click multi-select"}</span>
      </div>

      <div className={styles.stageWrap}>
        <svg
          ref={svgRef}
          className={styles.stage}
          data-background={spatialDocument.backgroundKind}
          data-page-mode={spatialDocument.pageMode}
          role="application"
          aria-label={node.kind === "whiteboard" ? "Collaborative whiteboard" : "Spatial note canvas"}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onPointerCancel={pointerUp}
          onWheel={wheel}
        >
          <g transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.zoom})`}>
            {spatialDocument.pageMode !== "infinite" ? (
              <rect
                className={styles.paper}
                x={0}
                y={0}
                width={spatialDocument.orientation === "landscape" ? 1123 : 794}
                height={spatialDocument.pageMode === "vertical" ? 4000 : spatialDocument.orientation === "landscape" ? 794 : 1123}
                rx={4}
              />
            ) : null}

            {sortedElements.map((element) => {
              const isSelected = selected.includes(element.id);
              const stroke =
                element.type === "highlighter_stroke"
                  ? String(element.payload.color ?? "#facc15")
                  : String(element.payload.color ?? "#111827");
              if (element.type === "ink_stroke" || element.type === "highlighter_stroke") {
                return (
                  <g key={element.id} onPointerDown={(event) => onElementPointerDown(event, element)}>
                    <path
                      d={pathFromPoints((element.payload.points ?? []) as SpatialPoint[])}
                      fill="none"
                      stroke={stroke}
                      strokeWidth={Number(element.payload.strokeWidth ?? 3)}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity={element.type === "highlighter_stroke" ? 0.35 : 1}
                      className={isSelected ? styles.selectedPath : undefined}
                    />
                  </g>
                );
              }
              if (element.type === "connector") {
                return (
                  <g key={element.id} onPointerDown={(event) => onElementPointerDown(event, element)}>
                    <line
                      x1={element.x}
                      y1={element.y}
                      x2={Number(element.payload.x2 ?? element.x + element.width)}
                      y2={Number(element.payload.y2 ?? element.y + element.height)}
                      stroke="#64748b"
                      strokeWidth={isSelected ? 4 : 2}
                    />
                  </g>
                );
              }
              return (
                <g
                  key={element.id}
                  transform={`rotate(${element.rotation} ${element.x + element.width / 2} ${element.y + element.height / 2})`}
                  onPointerDown={(event) => onElementPointerDown(event, element)}
                  className={isSelected ? styles.selectedElement : undefined}
                >
                  <rect
                    x={element.x}
                    y={element.y}
                    width={element.width}
                    height={element.height}
                    rx={element.type === "sticky" ? 8 : 5}
                    fill={
                      element.type === "frame"
                        ? "transparent"
                        : element.type === "sticky"
                          ? "#fef08a"
                          : element.type === "text_region"
                            ? "rgba(255,255,255,.72)"
                            : element.type === "file_attachment" ||
                                element.type === "audio_anchor" ||
                                element.type === "image"
                              ? "#f1f5f9"
                              : element.type === "link_card" || element.type === "embed"
                                ? "#ecfeff"
                                : String(element.payload.fill ?? "#dbeafe")
                    }
                    stroke={isSelected ? "#2563eb" : "#64748b"}
                    strokeWidth={isSelected ? 3 : 1.5}
                    strokeDasharray={element.type === "frame" ? "8 6" : undefined}
                  />
                  {["text_region", "sticky"].includes(element.type) ? (
                    <foreignObject
                      x={element.x + 10}
                      y={element.y + 10}
                      width={Math.max(1, element.width - 20)}
                      height={Math.max(1, element.height - 20)}
                    >
                      <div className={styles.elementText}>
                        {String(element.payload.text ?? "")}
                      </div>
                    </foreignObject>
                  ) : null}
                  {["file_attachment", "image", "audio_anchor"].includes(element.type) ? (
                    <text x={element.x + 12} y={element.y + 28} className={styles.svgLabel}>
                      {element.type === "image" ? "Image" : element.type === "audio_anchor" ? "Audio" : "File"} · Asset {String(element.payload.assetId ?? "").slice(0, 12)}
                    </text>
                  ) : null}
                  {["link_card", "embed"].includes(element.type) ? (
                    <text x={element.x + 12} y={element.y + 28} className={styles.svgLabel}>
                      {String(element.payload.url ?? "").slice(0, 42)}
                    </text>
                  ) : null}
                  {element.type === "frame" ? (
                    <text x={element.x + 10} y={element.y + 24} className={styles.svgLabel}>
                      {String(element.payload.label ?? "Frame")}
                    </text>
                  ) : null}
                </g>
              );
            })}

            {draftPoints.length > 1 ? (
              <path
                d={pathFromPoints(draftPoints)}
                fill="none"
                stroke={tool === "highlighter" ? "#facc15" : "#111827"}
                strokeWidth={tool === "highlighter" ? 14 : 3}
                opacity={tool === "highlighter" ? 0.35 : 1}
                strokeLinecap="round"
                strokeLinejoin="round"
                pointerEvents="none"
              />
            ) : null}
            {lasso ? (
              <rect
                x={lasso.x}
                y={lasso.y}
                width={lasso.width}
                height={lasso.height}
                fill="rgba(37,99,235,.08)"
                stroke="#2563eb"
                strokeDasharray="6 4"
                pointerEvents="none"
              />
            ) : null}
          </g>
        </svg>

        <aside className={styles.minimap} aria-label="Canvas minimap">
          {sortedElements.slice(0, 500).map((element) => (
            <span
              key={element.id}
              style={{
                left: `${((element.x - minimapBounds.minX) / minimapBounds.width) * 100}%`,
                top: `${((element.y - minimapBounds.minY) / minimapBounds.height) * 100}%`,
                width: `${Math.max(1, (element.width / minimapBounds.width) * 100)}%`,
                height: `${Math.max(1, (element.height / minimapBounds.height) * 100)}%`,
              }}
            />
          ))}
        </aside>
      </div>

      <aside className={styles.inspector} aria-label="Canvas inspector">
        <div>
          <strong>Selection</strong>
          <span>{selected.length} object{selected.length === 1 ? "" : "s"}</span>
        </div>
        {selectedElement && ["text_region", "sticky"].includes(selectedElement.type) ? (
          <label>
            Text
            <textarea
              rows={4}
              value={String(selectedElement.payload.text ?? "")}
              onChange={(event) => updateSelectedText(event.currentTarget.value)}
            />
          </label>
        ) : null}
        <div className={styles.inspectorActions}>
          <Button
            variant="secondary"
            disabled={selected.length === 0}
            onClick={() => deleteElements(selected)}
          >
            Delete selection
          </Button>
          <Button variant="secondary" onClick={() => setViewport({ x: 40, y: 40, zoom: 1 })}>
            Reset view
          </Button>
        </div>
      </aside>

      <details className={styles.objectList}>
        <summary>Accessible object list ({sortedElements.length})</summary>
        <div>
          {sortedElements.map((element) => (
            <button
              key={element.id}
              type="button"
              onClick={() => setSelected([element.id])}
              aria-pressed={selected.includes(element.id)}
            >
              {element.type.replaceAll("_", " ")} · {element.id.slice(0, 8)}
            </button>
          ))}
        </div>
      </details>

      <p className={styles.live} aria-live="polite">{status}</p>
    </section>
  );
}
