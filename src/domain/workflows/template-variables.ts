export interface TemplateRecipient {
  displayName: string | null;
  username: string | null;
}

export function renderTemplateVariables(text: string, recipient: TemplateRecipient) {
  const name = recipient.displayName || recipient.username || "fan";
  const username = recipient.username ? `@${recipient.username.replace(/^@/, "")}` : name;
  return text
    .replaceAll("{{nombre}}", name)
    .replaceAll("{{usuario}}", username);
}
