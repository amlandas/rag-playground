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

export type TourStep = {
  id: string;
  targetId: string;
  title: string;
  body: string;
  placement?: "top" | "bottom" | "left" | "right";
  requireVisible?: boolean;
};

export type TargetRect = {
  top: number;
  left: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
};

type TourContextValue = {
  isActive: boolean;
  currentStepId: string | null;
  currentStep: TourStep | null;
  targetRect: TargetRect | null;
  startTour: (tourId: "playground") => void;
  stopTour: () => void;
  nextStep: () => void;
};

const defaultValue: TourContextValue = {
  isActive: false,
  currentStepId: null,
  currentStep: null,
  targetRect: null,
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

const playgroundSteps: TourStep[] = [
  {
    id: "mode-tabs",
    targetId: "mode-tabs",
    title: "Choose your RAG mode",
    body:
      "Start simple, compare A/B retrieval profiles, or switch to Graph RAG to see explainable subqueries and hops.",
  },
  {
    id: "uploader",
    targetId: "uploader-dropzone",
    title: "Upload your documents",
    body:
      "Drop in your PDFs or text files here, or use the sample dataset to explore the playground quickly.",
  },
  {
    id: "build-index",
    targetId: "build-index",
    title: "Build an index",
    body:
      "Once your files are uploaded, build an index so the retriever can find relevant passages efficiently.",
    requireVisible: true,
  },
  {
    id: "query-input",
    targetId: "query-input",
    title: "Ask a question",
    body:
      "Type a natural-language query—like “What is our PTO policy?”—to run retrieval and generation over your uploaded context.",
  },
  {
    id: "run-button",
    targetId: "run-button",
    title: "Run the query",
    body:
      "Hit Run to test your retrieval setup. In A/B mode, you can compare two profiles side by side.",
    requireVisible: true,
  },
  {
    id: "graph-settings",
    targetId: "graph-settings",
    title: "Graph RAG settings",
    body:
      "Tune hops, top-k, and verification strategy when exploring Graph RAG. This is where you experiment with graph behaviors.",
    requireVisible: true,
  },
  {
    id: "graph-trace",
    targetId: "graph-show-trace",
    title: "Inspect the trace",
    body:
      "Use the Graph trace view to see subqueries, hops, and evidence that contributed to the final answer.",
    requireVisible: true,
  },
  {
    id: "metrics-toggle",
    targetId: "metrics-toggle",
    title: "See metrics & history",
    body:
      "Open the metrics drawer to inspect recent queries and performance stats—useful when tuning retrieval settings.",
    requireVisible: true,
  },
  {
    id: "feedback-bar",
    targetId: "feedback-bar",
    title: "Collect feedback",
    body:
      "Mark answers as helpful or not—this is where you’d wire in user feedback loops in a real production app.",
    requireVisible: false,
  },
];

type TourProviderProps = PropsWithChildren<{
  initialTourId?: "playground" | null;
}>;

export function TourProvider({ children, initialTourId = null }: TourProviderProps) {
  const initialActive = initialTourId === "playground";
  const [isActive, setIsActive] = useState(initialActive);
  const [activeTourId, setActiveTourId] = useState<"playground" | null>(
    initialActive ? "playground" : null,
  );
  const [steps, setSteps] = useState<TourStep[]>(() => (initialActive ? playgroundSteps : []));
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [activeElement, setActiveElement] = useState<HTMLElement | null>(null);

  const currentStep = useMemo(() => {
    if (!steps.length) return null;
    return steps[currentIndex] ?? null;
  }, [steps, currentIndex]);

  const startTour = useCallback((tourId: "playground") => {
    if (tourId === "playground") {
      setActiveTourId("playground");
      setSteps(playgroundSteps);
      setCurrentIndex(0);
      setIsActive(true);
    }
  }, []);

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
  }, [steps.length, stopTour]);

  useEffect(() => {
    if (!isActive || !currentStep || typeof document === "undefined") {
      setActiveElement(null);
      setTargetRect(null);
      return undefined;
    }

    const selector = `[data-tour-id="${currentStep.targetId}"]`;
    const element = document.querySelector(selector) as HTMLElement | null;

    const scheduleSkip = (reason: string) => {
      setActiveElement(null);
      setTargetRect(null);
      console.debug(`[tour] ${reason} for step "${currentStep.id}" (${selector})`);
      nextStep();
    };

    if (!element) {
      scheduleSkip("target missing");
      return;
    }

    const rect = element.getBoundingClientRect();
    if ((rect.width === 0 && rect.height === 0) || !Number.isFinite(rect.top)) {
      scheduleSkip("target hidden");
      return;
    }

    try {
      element.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    } catch {
      /* ignore */
    }
    setActiveElement(element);
  }, [currentStep, isActive, nextStep]);

  useEffect(() => {
    if (!activeElement || typeof window === "undefined") {
      setTargetRect(null);
      return;
    }

    const updateRect = () => {
      const rect = activeElement.getBoundingClientRect();
      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        right: rect.right,
        bottom: rect.bottom,
      });
    };

    updateRect();

    const handleScroll = () => updateRect();
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", updateRect);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(updateRect);
      resizeObserver.observe(activeElement);
    }

    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", updateRect);
      resizeObserver?.disconnect();
    };
  }, [activeElement]);

  const value: TourContextValue = {
    isActive,
    currentStepId: currentStep?.id ?? null,
    currentStep,
    targetRect,
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
