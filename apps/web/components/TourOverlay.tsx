"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useTour } from "./TourProvider";

type TargetMeta = {
  rect: DOMRect;
  isVisible: boolean;
};

export default function TourOverlay() {
  const { isActive, currentStep, nextStep, stopTour } = useTour();
  const [targetMeta, setTargetMeta] = useState<TargetMeta | null>(null);

  useEffect(() => {
    if (!currentStep) {
      setTargetMeta(null);
      return;
    }

    const element = document.querySelector(currentStep.targetSelector) as HTMLElement | null;
    if (!element) {
      if (currentStep.requireVisible) {
        nextStep();
      }
      setTargetMeta(null);
      return;
    }

    const rect = element.getBoundingClientRect();
    setTargetMeta({ rect, isVisible: true });
  }, [currentStep, nextStep]);

  const cardStyle = useMemo<React.CSSProperties>(() => {
    if (!targetMeta || typeof window === "undefined") return {};
    const { rect } = targetMeta;
    const top = Math.min(window.innerHeight - 180, rect.bottom + 12);
    const left = Math.min(Math.max(rect.left + rect.width / 2, 180), window.innerWidth - 20);
    return { top, left };
  }, [targetMeta]);

  if (!isActive || !currentStep) {
    return null;
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-base-300/60 backdrop-blur-sm pointer-events-none" />
      <div
        className="fixed z-50 w-[90%] max-w-sm left-1/2 -translate-x-1/2 bottom-4 md:bottom-8"
        style={targetMeta ? { top: cardStyle.top, left: cardStyle.left, transform: "translate(-50%, 0)" } : undefined}
      >
        <div className="card bg-base-100 shadow-xl border border-base-300">
          <div className="card-body space-y-3">
            <h3 className="card-title text-sm md:text-base">{currentStep.title}</h3>
            <p className="text-sm text-base-content/70">{currentStep.body}</p>
            <div className="card-actions mt-2 justify-between">
              <button className="btn btn-ghost btn-sm" type="button" onClick={stopTour}>
                Skip tour
              </button>
              <button className="btn btn-primary btn-sm" type="button" onClick={nextStep}>
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
