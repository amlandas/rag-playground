import { useCallback, useEffect, useRef } from "react";

import { queryAdvancedGraph } from "./rag-api";
import type { AdvancedQueryPayload } from "./rag-api";
import type { AdvancedQueryResponse, GraphRagTrace, RetrievedChunk } from "./types";

type BusyState = "idle" | "uploading" | "indexing" | "querying" | "comparing";

type GraphSettingsState = {
  k: number;
  maxHops: number;
  temperature: number;
  rerank: "ce" | "llm";
  verificationMode: "none" | "ragv" | "llm";
};

type GraphRunnerState = {
  sessionId: string | null;
  authRequired: boolean;
  authGateActive: boolean;
  indexed: boolean;
  query: string;
  graphSettings: GraphSettingsState;
  llmRerankAllowed: boolean;
  factCheckLlmAllowed: boolean;
};

type GraphRunnerActions = {
  setBusy: (state: BusyState) => void;
  setAnswer: (value: string) => void;
  setAnswerComplete: (value: boolean) => void;
  setSources: (chunks: RetrievedChunk[]) => void;
  setGraphResult: (result: AdvancedQueryResponse | null) => void;
  setGraphTrace: (trace: GraphRagTrace | null) => void;
  setShowGraphTrace: (value: boolean) => void;
  setError: (value: string | null) => void;
};

type Config = {
  state: GraphRunnerState;
  actions: GraphRunnerActions;
  friendlyError: (error: unknown) => string;
  executeGraphQuery?: typeof queryAdvancedGraph;
};

export function useGraphRunner(config: Config) {
  const configRef = useRef(config);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  return useCallback(async () => {
    const {
      state,
      actions,
      friendlyError,
      executeGraphQuery = queryAdvancedGraph,
    } = configRef.current;

    const {
      sessionId,
      authRequired,
      authGateActive,
      indexed,
      query,
      graphSettings,
      llmRerankAllowed,
      factCheckLlmAllowed,
    } = state;
    const {
      setBusy,
      setAnswer,
      setAnswerComplete,
      setSources,
      setGraphResult,
      setGraphTrace,
      setShowGraphTrace,
      setError,
    } = actions;

    if (!sessionId) {
      setError("Upload documents and build an index before running Graph RAG.");
      return;
    }
    if (authRequired) {
      setError("Sign in with Google to run Graph RAG queries.");
      return;
    }
    if (authGateActive) {
      setError("Authentication is still loading. Please try again in a moment.");
      return;
    }
    if (!indexed) {
      setError("Build an index before running Graph RAG queries.");
      return;
    }
    if (!query.trim()) {
      setError("Enter a question before running Graph RAG.");
      return;
    }

    setBusy("querying");
    setAnswer("");
    setAnswerComplete(false);
    setSources([]);
    setGraphResult(null);
    setGraphTrace(null);
    setShowGraphTrace(false);
    setError(null);

    const sanitizedRerank =
      graphSettings.rerank === "llm" && !llmRerankAllowed ? "ce" : graphSettings.rerank;
    const sanitizedVerification =
      graphSettings.verificationMode === "llm" && !factCheckLlmAllowed
        ? "ragv"
        : graphSettings.verificationMode;

    try {
      const payload: AdvancedQueryPayload = {
        session_id: sessionId,
        query,
        k: graphSettings.k,
        max_hops: graphSettings.maxHops,
        temperature: graphSettings.temperature,
        rerank: sanitizedRerank,
        verification_mode: sanitizedVerification,
      };

      const response = await executeGraphQuery(payload);
      setAnswer(response.answer);
      setAnswerComplete(true);
      const normalizedSources: RetrievedChunk[] = response.subqueries.flatMap((sub) =>
        sub.retrieved_meta.map((meta) => ({
          rank: meta.rank,
          doc_id: meta.doc_id,
          start: meta.start,
          end: meta.end,
          text: meta.text,
          similarity: meta.dense_score,
          lexical_score: meta.lexical_score,
          fused_score: meta.fused_score,
          rerank_score: meta.rerank_score ?? undefined,
        })),
      );
      setSources(normalizedSources);
      setGraphResult(response);
      setGraphTrace(response.trace ?? null);
      setShowGraphTrace(false);
    } catch (error) {
      setError(friendlyError(error));
      setGraphResult(null);
      setGraphTrace(null);
    } finally {
      setBusy("idle");
    }
  }, []);
}
