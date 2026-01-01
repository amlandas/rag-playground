import json
from typing import TypedDict, List
from openai import OpenAI
from ..config import settings

class UnsupportedClaim(TypedDict):
    claim: str
    reason: str

class IrrelevantSpan(TypedDict):
    chunk_id: str
    reason: str

class EvalResult(TypedDict):
    # Relevance
    answer_relevance_score: float
    answer_relevance_analysis: str
    
    # Faithfulness
    faithfulness_score: float
    hallucination_rate: float
    unsupported_claims: List[UnsupportedClaim]
    
    # Context Precision (Retrieval Quality)
    context_precision_score: float
    irrelevant_context_spans: List[IrrelevantSpan]
    
    # Context Recall (Information Retrieval)
    context_recall_score: float
    missing_information: List[str]
    
    # Completeness
    answer_completeness_score: float
    missing_key_points: List[str]
    
    # Conciseness
    conciseness_score: float
    unnecessary_content_summary: str
    
    # Overall
    overall_quality_score: float
    overall_comments: str

client = OpenAI(
    api_key=settings.OPENAI_API_KEY,
    base_url=settings.OPENAI_BASE_URL
)

PROMPT = """
You are an expert scientific evaluator for a RAG (Retrieval-Augmented Generation) system.
Your task is to analyze the quality of a Generated Answer based on a User Query and Retrieved Context.

You must score the system on the following 6 dimensions using a rigorous scientific approach.

1. Answer Relevance (0-10):
   - Does the answer directly address the user's intent?
   - Ignore context quality here; just check if the answer feels like a valid response to the query.

2. Faithfulness / Groundedness (0-10):
   - Are all claims in the answer supported by the Context?
   - Calculate a 'hallucination_rate' (0.0 to 1.0) and list specific unsupported claims.

3. Context Precision (0-10):
   - How much of the Retrieved Context was actually useful?
   - Identify specific chunks (by ID or index) that were irrelevant noise.

4. Context Recall (0-10):
   - Did the context contain *enough* information to fully answer the query?
   - If the answer says "I don't know" or mimics missing info, this score should be low.
   - List what information appears to be missing.

5. Answer Completeness (0-10):
   - Did the answer cover all key aspects of the query?

6. Conciseness (0-10):
   - Is the response efficient?
   - Penalize for fluff, repetition, or unnecessary verbosity.

Output a VALID JSON object with this exact schema:
{{
  "answer_relevance_score": float (0-10),
  "answer_relevance_analysis": "string",
  
  "faithfulness_score": float (0-10),
  "hallucination_rate": float (0.0-1.0),
  "unsupported_claims": [
    {{ "claim": "string", "reason": "string" }}
  ],
  
  "context_precision_score": float (0-10),
  "irrelevant_context_spans": [
    {{ "chunk_id": "string", "reason": "string" }}
  ],
  
  "context_recall_score": float (0-10),
  "missing_information": ["string"],
  
  "answer_completeness_score": float (0-10),
  "missing_key_points": ["string"],
  
  "conciseness_score": float (0-10),
  "unnecessary_content_summary": "string",
  
  "overall_quality_score": float (0-10),
  "overall_comments": "string"
}}

USER QUERY: {query}

RETRIEVED CONTEXT:
{context}

GENERATED ANSWER: {answer}
"""

def evaluate_answer(query: str, answer: str, context: str) -> EvalResult:
    """
    Evaluates the RAG answer using a comprehensive scientific matrix.
    """
    def _call_model(temp: float) -> dict:
        response = client.chat.completions.create(
            model="gpt-5-mini",
            messages=[
                {"role": "system", "content": "You are a precise RAG component evaluator. Output JSON only."},
                {"role": "user", "content": PROMPT.format(query=query, context=context, answer=answer)}
            ],
            temperature=temp,
            response_format={"type": "json_object"}
        )
        content = response.choices[0].message.content
        if not content:
            raise ValueError("Empty response from evaluator")
        return json.loads(content)

    try:
        # Improved robustness: Attempt low temp for precision, fallback to default if strictness causes refusal
        try:
            print(f"[evaluator] Attempting scientific eval with temperature=0.2", flush=True)
            data = _call_model(0.2)
        except Exception as e:
            print(f"[evaluator] WARN: Temp 0.2 failed ({e}), retrying with 1.0", flush=True)
            data = _call_model(1.0)
        
        print(f"[evaluator] DEBUG: Relevance: {data.get('answer_relevance_score')}", flush=True)
        print(f"[evaluator] DEBUG: Faithfulness: {data.get('faithfulness_score')}", flush=True)
        
        return data # Type matching is loose here but schema should align
        
    except Exception as e:
        print(f"[evaluator] error: {e}", flush=True)
        # Return a safe zero-filled object
        return {
            "answer_relevance_score": 0.0,
            "answer_relevance_analysis": f"Error: {str(e)}",
            "faithfulness_score": 0.0,
            "hallucination_rate": 0.0,
            "unsupported_claims": [],
            "context_precision_score": 0.0,
            "irrelevant_context_spans": [],
            "context_recall_score": 0.0,
            "missing_information": [],
            "answer_completeness_score": 0.0,
            "missing_key_points": [],
            "conciseness_score": 0.0,
            "unnecessary_content_summary": "",
            "overall_quality_score": 0.0,
            "overall_comments": "Evaluation failed due to system error."
        }
