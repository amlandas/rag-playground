"use client";

import React, { useMemo } from "react";
import { useTour, type TargetRect } from "./TourProvider";

const CARD_HEIGHT = 190;
const CARD_MARGIN = 16;

export default function TourOverlay() {
  const { isActive, currentStep, targetRect, nextStep, stopTour } = useTour();

  const dialogPosition = useMemo(() => computeDialogPosition(targetRect), [targetRect]);

  if (!isActive || !currentStep) {
    return null;
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-base-100/40 pointer-events-none" />
      {targetRect ? (
        <div
          className="fixed z-50 pointer-events-none rounded-xl border-2 border-primary/70 shadow-[0_0_25px_rgba(0,0,0,0.45)] transition-all duration-200"
          style={{
            top: Math.max(targetRect.top - 8, 8),
            left: Math.max(targetRect.left - 8, 8),
            width: targetRect.width + 16,
            height: targetRect.height + 16,
          }}
        />
      ) : null}
      <div
        className="fixed z-50 w-[90%] max-w-md"
        style={
          dialogPosition
            ? {
                top: dialogPosition.top,
                left: dialogPosition.left,
                width: dialogPosition.width,
              }
            : { left: "50%", transform: "translateX(-50%)", bottom: CARD_MARGIN }
        }
      >
        <div className="card bg-base-100 shadow-xl border border-base-300 w-full">
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

function computeDialogPosition(rect: TargetRect | null) {
  if (!rect || typeof window === "undefined") {
    return null;
  }
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const width = Math.min(360, viewportWidth - CARD_MARGIN * 2);
  let top = rect.bottom + CARD_MARGIN;
  if (top + CARD_HEIGHT > viewportHeight - CARD_MARGIN) {
    top = rect.top - CARD_HEIGHT - CARD_MARGIN;
  }
  if (top < CARD_MARGIN) {
    top = Math.min(viewportHeight - CARD_HEIGHT - CARD_MARGIN, Math.max(CARD_MARGIN, rect.top));
  }
  let left = rect.left + rect.width / 2 - width / 2;
  left = Math.max(CARD_MARGIN, Math.min(left, viewportWidth - width - CARD_MARGIN));
  return { top, left, width };
}
