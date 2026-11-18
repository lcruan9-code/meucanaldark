export async function generateOllama({ prompt, systemPrompt, model = "llama3", host = "http://localhost:11434" }) {
  const url = `${host.replace(/\/$/, "")}/api/generate`;
  const body = {
    model,
    prompt,
    system: systemPrompt,
    stream: false,
    format: "json",
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`[llm-ollama] Ollama HTTP ${res.status}: ${errorText}`);
  }

  const json = await res.json();
  const rawText = json.response;
  let data;
  try {
    data = JSON.parse(rawText);
  } catch (err) {
    throw new Error(`[llm-ollama] Response is not valid JSON: ${err.message}\nRaw: ${rawText}`);
  }

  return {
    rawText,
    data,
    meta: {
      backend: "ollama",
      model,
      durationMs: json.total_duration ? Math.round(json.total_duration / 1e6) : 0,
      evalCount: json.eval_count,
    },
  };
}
