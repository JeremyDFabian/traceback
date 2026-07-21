"use client";

import { PointerEvent, useEffect, useRef, useState } from "react";

type TimerMode = "focus" | "break";

const durationFor = (mode: TimerMode) => (mode === "focus" ? 25 * 60 : 5 * 60);

export function FocusTimer() {
  const [mode, setMode] = useState<TimerMode>("focus");
  const [secondsLeft, setSecondsLeft] = useState(durationFor("focus"));
  const [isRunning, setIsRunning] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragStart = useRef<
    { x: number; y: number; offsetX: number; offsetY: number } | undefined
  >(undefined);

  useEffect(() => {
    if (!isRunning) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current > 1) return current - 1;
        setIsRunning(false);
        setMode((currentMode) => {
          const nextMode = currentMode === "focus" ? "break" : "focus";
          setSecondsLeft(durationFor(nextMode));
          return nextMode;
        });
        return 0;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isRunning]);

  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const seconds = String(secondsLeft % 60).padStart(2, "0");

  function toggleMode() {
    const nextMode = mode === "focus" ? "break" : "focus";
    setMode(nextMode);
    setSecondsLeft(durationFor(nextMode));
    setIsRunning(false);
  }

  function beginDrag(event: PointerEvent<HTMLElement>) {
    if ((event.target as HTMLElement).closest("button")) return;
    dragStart.current = {
      x: event.clientX,
      y: event.clientY,
      offsetX: offset.x,
      offsetY: offset.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function drag(event: PointerEvent<HTMLElement>) {
    if (!dragStart.current) return;
    const nextX =
      dragStart.current.offsetX + event.clientX - dragStart.current.x;
    const nextY =
      dragStart.current.offsetY + event.clientY - dragStart.current.y;
    setOffset({
      x: Math.max(
        -window.innerWidth + 78,
        Math.min(window.innerWidth - 78, nextX),
      ),
      y: Math.max(
        -window.innerHeight + 74,
        Math.min(window.innerHeight - 74, nextY),
      ),
    });
  }

  if (isCollapsed) {
    return (
      <button
        type="button"
        className="focus-timer-toggle"
        aria-label="Show focus session timer"
        onClick={() => setIsCollapsed(false)}
      >
        <span aria-hidden="true">◷</span>
        {mode === "focus" ? "Focus" : "Break"} {minutes}:{seconds}
      </button>
    );
  }

  return (
    <aside
      className="floating-focus-timer"
      aria-label="Draggable Pomodoro focus timer"
      onPointerDown={beginDrag}
      onPointerMove={drag}
      onPointerUp={() => {
        dragStart.current = undefined;
      }}
      onPointerCancel={() => {
        dragStart.current = undefined;
      }}
      style={{ transform: `translate3d(${offset.x}px, ${offset.y}px, 0)` }}
    >
      <div className="focus-timer-heading">
        <span aria-hidden="true">⠿</span>
        <p>{mode === "focus" ? "Focus session" : "Short break"}</p>
        <button
          type="button"
          className="focus-timer-hide"
          aria-label="Hide focus session timer"
          onClick={() => setIsCollapsed(true)}
        >
          Hide
        </button>
      </div>
      <strong aria-live="polite">
        {minutes}:{seconds}
      </strong>
      <div>
        <button type="button" className="text-button" onClick={toggleMode}>
          {mode === "focus" ? "Break" : "Focus"}
        </button>
        <button
          type="button"
          className="focus-timer-start"
          onClick={() => setIsRunning((running) => !running)}
        >
          {isRunning ? "Pause" : "Start"}
        </button>
      </div>
    </aside>
  );
}
