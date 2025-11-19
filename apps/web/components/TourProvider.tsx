"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { useOptionalAuth } from "./AuthProvider";

export type TourStep = {
  id: string;
  targetSelector: string;
  title: string;
  body: string;
  placement?: "top" | "bottom" | "left" | "right";
  requireVisible?: boolean;
};

type TourContextValue = {
  isActive: boolean;
  currentStepId: string | null;
  currentStep: TourStep | null;
  startTour: (tourId: "playground") => void;
  stopTour: () => void;
  nextStep: () => void;
};

const defaultValue: TourContextValue = {
  isActive: false,
  currentStepId: null,
  currentStep: null,
  startTour: () => {
    /* noop */
  },
  stopTour: () => {
    /* noop */
  },
  nextStep: () => {
    /* noop */
  },
};

const TourContext = createContext<TourContextValue | undefined>(undefined);

const signInStep: TourStep = {
  id: "sign-in",
  targetSelector: '[data-tour-id="sign-in"]',
  title: "Sign in with Google",
  body: "Sign in to unlock uploads, metrics, and admin tools tied to your account.",
  requireVisible: true,
};

const basePlaygroundSteps: TourStep[] = [
  {
    id: "mode-tabs",
    targetSelector: '[data-tour-id="mode-tabs"]',
    title: "Choose your RAG mode",
    body:
      "Start simple, compare A/B retrieval profiles, or switch to Graph RAG to see explainable subqueries and hops.",
  },
  {
    id: "uploader",
    targetSelector: '[data-tour-id="uploader-dropzone"]',
    title: "Upload your documents",
    body:
      "Drop in your PDFs or text files here, or use the sample dataset to explore the playground quickly.",
  },
  {
    id: "build-index",
    targetSelector: '[data-tour-id="build-index"]',
    title: "Build an index",
    body:
      "Once your files are uploaded, build an index so the retriever can find relevant passages efficiently.",
    requireVisible: true,
  },
  {
    id: "query-input",
    targetSelector: '[data-tour-id="query-input"]',
    title: "Ask a question",
    body:
      "Type a natural-language query—like “What is our PTO policy?”—to run retrieval and generation over your uploaded context.",
  },
  {
    id: "run-button",
    targetSelector: '[data-tour-id="run-button"]',
    title: "Run the query",
    body:
      "Hit Run to test your retrieval setup. In A/B mode, you can compare two profiles side by side.",
    requireVisible: true,
  },
  {
    id: "graph-settings",
    targetSelector: '[data-tour-id="graph-settings"]',
    title: "Graph RAG settings",
    body:
      "Tune hops, top-k, and verification strategy when exploring Graph RAG. This is where you experiment with graph behaviors.",
    requireVisible: true,
  },
  {
    id: "graph-trace",
    targetSelector: '[data-tour-id="graph-show-trace"]',
    title: "Inspect the trace",
    body:
      "Use the Graph trace view to see subqueries, hops, and evidence that contributed to the final answer.",
    requireVisible: true,
  },
  {
    id: "metrics-toggle",
    targetSelector: '[data-tour-id="metrics-toggle"]',
    title: "See metrics & history",
    body:
      "Open the metrics drawer to inspect recent queries and performance stats—useful when tuning retrieval settings.",
    requireVisible: true,
  },
  {
    id: "feedback-bar",
    targetSelector: '[data-tour-id="feedback-bar"]',
    title: "Collect feedback",
    body:
      "Mark answers as helpful or not—this is where you’d wire in user feedback loops in a real production app.",
    requireVisible: false,
  },
];

type TourProviderProps = PropsWithChildren<{
  initialTourId?: "playground" | null;
  authStateOverride?: { authEnabled: boolean; isAuthenticated: boolean };
}>;

export function TourProvider({
  children,
  initialTourId = null,
  authStateOverride,
}: TourProviderProps) {
  const optionalAuth = useOptionalAuth();
  const derivedAuthState =
    authStateOverride ??
    {
      authEnabled: optionalAuth?.authEnabled ?? false,
      isAuthenticated: !!optionalAuth?.user,
    };

  const initialActive = initialTourId === "playground";
  const dynamicSteps = useMemo(() => {
    const steps = [...basePlaygroundSteps];
    if (derivedAuthState.authEnabled && !derivedAuthState.isAuthenticated) {
      steps.unshift(signInStep);
    }
    return steps;
  }, [derivedAuthState.authEnabled, derivedAuthState.isAuthenticated]);
  const [isActive, setIsActive] = useState(initialActive);
  const [activeTourId, setActiveTourId] = useState<"playground" | null>(
    initialActive ? "playground" : null,
  );
  const [steps, setSteps] = useState<TourStep[]>(() => (initialActive ? dynamicSteps : []));
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  const currentStep = useMemo(() => {
    if (!steps.length) return null;
    return steps[currentIndex] ?? null;
  }, [steps, currentIndex]);

  const startTour = useCallback(
    (tourId: "playground") => {
      if (tourId === "playground") {
        setActiveTourId("playground");
        setSteps(dynamicSteps);
        setCurrentIndex(0);
        setIsActive(true);
      }
    },
    [dynamicSteps],
  );

  const stopTour = useCallback(() => {
    setIsActive(false);
    setActiveTourId(null);
    setSteps([]);
    setCurrentIndex(0);
  }, []);

  const nextStep = useCallback(() => {
    setCurrentIndex((prev) => {
      const next = prev + 1;
      if (!steps.length || next >= steps.length) {
        stopTour();
        return 0;
      }
      return next;
    });
  }, [steps, stopTour]);

  useEffect(() => {
    if (isActive && activeTourId === "playground") {
      setSteps(dynamicSteps);
      setCurrentIndex((prev) => Math.min(prev, Math.max(dynamicSteps.length - 1, 0)));
    }
  }, [dynamicSteps, isActive, activeTourId]);

  const value: TourContextValue = {
    isActive,
    currentStepId: currentStep?.id ?? null,
    currentStep,
    startTour,
    stopTour,
    nextStep,
  };

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext);
  return ctx ?? defaultValue;
}
