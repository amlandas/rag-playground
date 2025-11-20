import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";

import { toSnippetPayload, type SnippetPayload } from "./abSnippets";
import { answerFromSnippetsSSE, compareRetrieval } from "./rag-api";
import type { CompareProfile, RetrievedChunk } from "./types";

type BusyState = "idle" | "uploading" | "indexing" | "querying" | "comparing";

type CompareRunnerState = {
  sessionId: string | null;
  authRequired: boolean;
  authGateActive: boolean;
  indexed: boolean;
  query: string;
  profileA: CompareProfile;
  profileB: CompareProfile;
};

type CompareRunnerActions = {
  setBusy: (state: BusyState) => void;
  setRetrievedA: Dispatch<SetStateAction<RetrievedChunk[]>>;
  setRetrievedB: Dispatch<SetStateAction<RetrievedChunk[]>>;
  setAnswerA: Dispatch<SetStateAction<string>>;
  setAnswerB: Dispatch<SetStateAction<string>>;
  setAnswerAComplete: Dispatch<SetStateAction<boolean>>;
  setAnswerBComplete: Dispatch<SetStateAction<boolean>>;
  setCompareError: Dispatch<SetStateAction<string | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
};

type Config = {
  state: CompareRunnerState;
  actions: CompareRunnerActions;
  friendlyError: (error: unknown) => string;
  executeCompare?: typeof compareRetrieval;
  streamAnswer?: typeof answerFromSnippetsSSE;
};

export function useCompareRunner(config: Config) {
  const configRef = useRef(config);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  return useCallback(async () => {
    const {
      state,
      actions,
      friendlyError,
      executeCompare = compareRetrieval,
      streamAnswer = answerFromSnippetsSSE,
    } = configRef.current;
    const { sessionId, authRequired, authGateActive, indexed, query, profileA, profileB } = state;
    const {
      setBusy,
      setRetrievedA,
      setRetrievedB,
      setAnswerA,
      setAnswerB,
      setAnswerAComplete,
      setAnswerBComplete,
      setCompareError,
      setError,
    } = actions;

    if (!sessionId) {
      return;
    }
    if (authRequired) {
      const message = "Sign in with Google to run comparisons.";
      setCompareError(message);
      setError(message);
      return;
    }
    if (authGateActive) {
      return;
    }
    if (!indexed) {
      const message = "Build an index before running A/B comparisons.";
      setCompareError(message);
      setError(message);
      return;
    }
    if (!query.trim()) {
      const message = "Enter a question before running A/B comparisons.";
      setCompareError(message);
      setError(message);
      return;
    }

    setBusy("comparing");
    setCompareError(null);
    setError(null);
    setRetrievedA([]);
    setRetrievedB([]);
    setAnswerA("");
    setAnswerB("");
    setAnswerAComplete(false);
    setAnswerBComplete(false);

    let retrievedA: RetrievedChunk[] = [];
    let retrievedB: RetrievedChunk[] = [];

    try {
      const response = await executeCompare({
        session_id: sessionId,
        query,
        profile_a: profileA,
        profile_b: profileB,
      });
      retrievedA = response.profile_a ?? [];
      retrievedB = response.profile_b ?? [];
      setRetrievedA(retrievedA);
      setRetrievedB(retrievedB);
    } catch (error) {
      const message = friendlyError(error);
      setCompareError(message);
      setError(message);
      setBusy("idle");
      return;
    }

    const snippetA = toSnippetPayload(retrievedA);
    const snippetB = toSnippetPayload(retrievedB);

    const runProfileAnswer = async (
      profile: CompareProfile,
      snippets: SnippetPayload,
      setAnswer: Dispatch<SetStateAction<string>>,
      markComplete: Dispatch<SetStateAction<boolean>>,
    ) => {
      let streamFailure: string | null = null;
      await streamAnswer(
        query,
        snippets,
        { model: profile.model, temperature: profile.temperature },
        {
          onToken: (token) => {
            setAnswer((prev) => prev + token);
          },
          onDone: () => {
            markComplete(true);
          },
          onError: (err) => {
            streamFailure = friendlyError(err);
          },
        },
      );
      if (streamFailure) {
        setCompareError(streamFailure);
        setError(streamFailure);
        return false;
      }
      return true;
    };

    try {
      const aOk = await runProfileAnswer(profileA, snippetA, setAnswerA, setAnswerAComplete);
      if (!aOk) {
        return;
      }
      const bOk = await runProfileAnswer(profileB, snippetB, setAnswerB, setAnswerBComplete);
      if (!bOk) {
        return;
      }
    } catch (error) {
      const message = friendlyError(error);
      setCompareError(message);
      setError(message);
    } finally {
      setBusy("idle");
    }
  }, []);
}
