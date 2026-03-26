import { JobPayload, JobResult } from "../jobRouter";

export async function runResearchAgent(data: JobPayload): Promise<JobResult> {
  const query =
    typeof data.payload?.query === "string" ? data.payload.query.trim() : "";
  const context =
    typeof data.payload?.context === "string"
      ? data.payload.context.trim()
      : "";

  if (!query) {
    throw new Error("query is required for research jobs");
  }

  const apiKey = process.env.PERPLEXITY_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("PERPLEXITY_API_KEY not set");
  }

  const response = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "llama-3.1-sonar-large-128k-online",
      messages: [
        {
          role: "system",
          content:
            "You are a research assistant for a HubSpot and RevOps consultancy. Provide concise, accurate, cited answers focused on practical implementation guidance."
        },
        {
          role: "user",
          content: context ? `Context: ${context}\n\nQuery: ${query}` : query
        }
      ],
      max_tokens: 2000,
      return_citations: true
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Perplexity API error: ${response.status} ${response.statusText} ${body}`
    );
  }

  const result = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    citations?: unknown[];
  };

  return {
    success: true,
    dryRun: false,
    output: {
      content: result.choices?.[0]?.message?.content ?? "",
      citations: result.citations ?? [],
      query
    }
  };
}
