from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from ..schemas import AnswerFromSnippetsRequest
from ..services.generate import stream_answer

router = APIRouter()


def sse_wrap(generator):
    for token in generator:
        yield f"data: {token}\n\n"
    yield "event: done\ndata: [DONE]\n\n"


@router.post("/answer_from_snippets")
async def answer_from_snippets(req: AnswerFromSnippetsRequest):
    pairs = [(snippet.rank, snippet.text) for snippet in req.snippets]
    gen = stream_answer(
        prompt=req.prompt,
        snippets=pairs,
        model=req.model,
        temperature=req.temperature,
    )
    return StreamingResponse(sse_wrap(gen), media_type="text/event-stream")
