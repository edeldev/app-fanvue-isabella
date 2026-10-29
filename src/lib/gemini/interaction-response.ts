type InteractionContent = {
  type?: string;
  text?: string;
};

type InteractionResponse = {
  output_text?: string;
  steps?: Array<{
    type?: string;
    content?: InteractionContent[];
  }>;
};

export function readGeminiInteractionText(body: InteractionResponse) {
  if (typeof body.output_text === "string" && body.output_text.trim()) {
    return body.output_text.trim();
  }

  return (body.steps ?? [])
    .filter((step) => step.type === "model_output")
    .flatMap((step) => step.content ?? [])
    .filter((content) =>
      content.type === "text" || content.type === "output_text" || !content.type,
    )
    .map((content) => content.text ?? "")
    .join("")
    .trim();
}

export function parseGeminiJson(value: string): unknown {
  const trimmed = value.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(withoutFence);
  } catch {
    const firstBrace = withoutFence.indexOf("{");
    const lastBrace = withoutFence.lastIndexOf("}");
    if (firstBrace < 0 || lastBrace <= firstBrace) return null;
    try {
      return JSON.parse(withoutFence.slice(firstBrace, lastBrace + 1));
    } catch {
      return null;
    }
  }
}
