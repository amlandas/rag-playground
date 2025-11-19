"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTour } from "./TourProvider";

type TargetMeta = {
  rect: DOMRect;
};

export default function TourOverlay() {
  const { isActive, currentStep, nextStep, stopTour } = useTour();
  const [targetMeta, setTargetMeta] = useState<TargetMeta | null>(null);
  const previousStepId = useRef<string | null>(null);

  useEffect(() => {
    if (!currentStep) {
      setTargetMeta(null);
      return;
    }

    const updateMeta = () => {
      const element = document.querySelector(currentStep.targetSelector) as HTMLElement | null;
      if (!element) {
        if (currentStep.requireVisible) {
          nextStep();
        }
        setTargetMeta(null);
        return;
      }

      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        if (currentStep.requireVisible) {
          nextStep();
        }
        setTargetMeta(null);
        return;
      }

      if (previousStepId.current !== currentStep.id) {
        element.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
        previousStepId.current = currentStep.id;
      }

      setTargetMeta({ rect });
    };

    updateMeta();
    window.addEventListener("resize", updateMeta);
    window.addEventListener("scroll", updateMeta, true);
    return () => {
      window.removeEventListener("resize", updateMeta);
      window.removeEventListener("scroll", updateMeta, true);
    };
  }, [currentStep, nextStep]);

  const cardStyle = useMemo<React.CSSProperties>(() => {
    if (!targetMeta || typeof window === "undefined") {
      return {};
    }

    const cardWidth = Math.min(360, window.innerWidth - 32);
    const cardHeight = 190;
    const { rect } = targetMeta;
    const canShowBelow = rect.bottom + cardHeight + 16 <= window.innerHeight;
    const top = canShowBelow
      ? rect.bottom + 16
      : Math.max(16, rect.top - cardHeight - 16);
    const left = Math.min(
      Math.max(rect.left + rect.width / 2 - cardWidth / 2, 16),
      window.innerWidth - cardWidth - 16,
    );
    return { top, left, width: cardWidth };
  }, [targetMeta]);

  const highlightStyle = useMemo<React.CSSProperties | undefined>(() => {
    if (!targetMeta || typeof window === "undefined") return undefined;
    const padding = 12;
    const width = Math.min(targetMeta.rect.width + padding * 2, window.innerWidth - 16);
    const height = Math.min(targetMeta.rect.height + padding * 2, window.innerHeight - 16);
    const top = Math.max(targetMeta.rect.top - padding, 8);
    const left = Math.max(targetMeta.rect.left - padding, 8);
    return {
      top,
      left,
      width,
      height,
      borderRadius: 12,
      boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.55)",
      border: "2px solid hsl(var(--p) / 0.8)",
    };
  }, [targetMeta]);

  if (!isActive || !currentStep) {
    return null;
  }

  return (
    <>
      {highlightStyle ? (
        <div
          className="pointer-events-none fixed z-40 transition-all duration-200"
          style={highlightStyle}
        />
      ) : (
        <div className="pointer-events-none fixed inset-0 z-40 bg-base-300/50" />
      )}
      <div
        className="fixed z-50 w-[90%] max-w-sm"
        style={
          targetMeta
            ? cardStyle
            : { left: "50%", transform: "translateX(-50%)", bottom: 32 }
        }
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
