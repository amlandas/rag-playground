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

class EvalResponse(BaseModel):
    faithfulness: float
    relevance: float
    reasoning: str

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
    
    return EvalResponse(
        faithfulness=result["faithfulness"],
        relevance=result["relevance"],
        reasoning=result["reasoning"]
    )
