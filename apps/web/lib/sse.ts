// POST to an SSE endpoint (text/event-stream) and parse events.
// Supports: event: retrieved (JSON), data: <token>, event: done
export async function postSSE(
  url: string,
  body: unknown,
  handlers: {
    onRetrieved?: (payload: any) => void;
    onToken?: (token: string) => void;
    onDone?: () => void;
    onError?: (err: Error) => void;
  }
) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    if (!res.ok || !res.body) {
      throw new Error(`SSE HTTP ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        const lines = part.split("\n");
        let event: string | null = null;
        let data: string | null = null;

        for (const line of lines) {
          if (line.startsWith("event:")) {
            event = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            const value = line.slice(5).trim();
            data = data ? `${data}\n${value}` : value;
          }
        }

        if (event === "retrieved" && data && handlers.onRetrieved) {
          try {
            handlers.onRetrieved(JSON.parse(data));
          } catch (error) {
            console.warn("Failed to parse retrieved payload", error);
          }
        } else if (event === "done") {
          handlers.onDone?.();
        } else if (data) {
          handlers.onToken?.(data);
        }
      }
    }

    if (buffer.length > 0) {
      handlers.onDone?.();
    }
  } catch (error: any) {
    handlers.onError?.(error);
  }
}
