from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException, Depends
from ..services.evaluator import evaluate_answer, EvalResult

router = APIRouter()

class EvalRequest(BaseModel):
    query: str
    answer: str
    sources: Optional[List[Dict[str, Any]]] = None
    context_text: Optional[str] = None

class UnsupportedClaim(BaseModel):
    claim: str
    reason: str

class IrrelevantSpan(BaseModel):
    chunk_id: str
    reason: str

class EvalResponse(BaseModel):
    answer_relevance_score: float
    answer_relevance_analysis: str
    
    faithfulness_score: float
    hallucination_rate: float
    unsupported_claims: List[UnsupportedClaim]
    
    context_precision_score: float
    irrelevant_context_spans: List[IrrelevantSpan]
    
    context_recall_score: float
    missing_information: List[str]
    
    answer_completeness_score: float
    missing_key_points: List[str]
    
    conciseness_score: float
    unnecessary_content_summary: str
    
    overall_quality_score: float
    overall_comments: str

@router.post("/eval", response_model=EvalResponse)
async def run_evaluation(payload: EvalRequest):
    """
    Run an LLM-as-a-judge evaluation on a RAG answer.
    """
    
    # Construct context from sources if not provided directly
    context = payload.context_text
    if not context and payload.sources:
        context = "\n\n".join(
            [f"Source {i+1}: {s.get('text', '')}" for i, s in enumerate(payload.sources)]
        )
    
    if not context:
        context = "No context provided."

    result = evaluate_answer(
        query=payload.query,
        answer=payload.answer,
        context=context
    )
    
    return EvalResponse(**result)
