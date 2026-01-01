import json
from typing import TypedDict
from openai import OpenAI
from ..config import settings

class EvalResult(TypedDict):
    faithfulness: float
    relevance: float
    reasoning: str

client = OpenAI(
    api_key=settings.OPENAI_API_KEY,
    base_url=settings.OPENAI_BASE_URL
)

PROMPT = """
You are an expert evaluator for a RAG (Retrieval-Augmented Generation) system.
Your task is to evaluate the quality of a generated Answer based on a given Query and Context.

You must score the Answer on two criteria:

1. Faithfulness (0.0 to 1.0):
   - Does the answer rely *only* on the provided Context?
   - Are there hallucinations or unverified claims?
   - 1.0 means fully supported by context. 0.0 means completely unsupported.

2. Relevance (0.0 to 1.0):
   - Does the answer directly address the User Query?
   - is it complete and helpful?
   - 1.0 means perfectly relevant. 0.0 means completely irrelevant.

Output your evaluation as a valid JSON object with the following keys:
- "faithfulness": float
- "relevance": float
- "reasoning": string (brief explanation of the scores, max 50 words)

USER QUERY: {query}

RETRIEVED CONTEXT:
{context}

GENERATED ANSWER: {answer}
"""

def evaluate_answer(query: str, answer: str, context: str) -> EvalResult:
    """
    Evaluates the RAG answer using an LLM-as-a-judge approach.
    """
    try:
        response = client.chat.completions.create(
            model="gpt-5-mini",  # Use a strong model for evaluation
            messages=[
                {"role": "system", "content": "You are a fair and critical RAG evaluator. Output JSON only."},
                {"role": "user", "content": PROMPT.format(query=query, context=context, answer=answer)}
            ],
            temperature=0.0,
            response_format={"type": "json_object"}
        )
        
        content = response.choices[0].message.content
        if not content:
            raise ValueError("Empty response from evaluator")
            
        data = json.loads(content)
        return {
            "faithfulness": float(data.get("faithfulness", 0.0)),
            "relevance": float(data.get("relevance", 0.0)),
            "reasoning": data.get("reasoning", "No reasoning provided.")
        }
    except Exception as e:
        print(f"[evaluator] error: {e}")
        # Fallback in case of error
        return {
            "faithfulness": 0.0,
            "relevance": 0.0,
            "reasoning": f"Evaluation failed: {str(e)}"
        }
