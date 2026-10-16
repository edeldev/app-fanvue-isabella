type SafeReply = {
  reply: string;
  spanishTranslation: string;
  needsSpanishTranslation: boolean;
  detectedLanguage: string;
};

const aiIdentityQuestion = /(?:\b(?:eres|sos|es usted)\b.{0,28}\b(?:ia|inteligencia artificial|robot|bot)\b)|(?:\b(?:are you|you are)\b.{0,28}\b(?:ai|artificial intelligence|robot|bot)\b)/iu;
export function enforceAiIdentityBoundary<T extends SafeReply>(suggestion: T, recentFanText: string): T {
  if (!aiIdentityQuestion.test(recentFanText)) return suggestion;
  const spanish = /español|spanish|castellano/i.test(suggestion.detectedLanguage);
  const english = /inglés|english/i.test(suggestion.detectedLanguage);
  if (english) {
    return {
      ...suggestion,
      reply: "I use an AI writing assistant, but I personally review messages before sending them. What made you ask?",
      spanishTranslation: "Uso un asistente de IA para redactar, pero reviso personalmente los mensajes antes de enviarlos. ¿Qué te hizo preguntarlo?",
      needsSpanishTranslation: true,
    };
  }
  if (spanish) {
    const reply = "Uso un asistente de IA para redactar, pero reviso personalmente los mensajes antes de enviarlos. ¿Qué te hizo preguntarlo?";
    return { ...suggestion, reply, spanishTranslation: reply, needsSpanishTranslation: false };
  }
  return suggestion;
}
