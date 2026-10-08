type SafeReply = {
  reply: string;
  spanishTranslation: string;
  needsSpanishTranslation: boolean;
  detectedLanguage: string;
};

const aiIdentityQuestion = /(?:\b(?:eres|sos|es usted)\b.{0,28}\b(?:ia|inteligencia artificial|robot|bot)\b)|(?:\b(?:are you|you are)\b.{0,28}\b(?:ai|artificial intelligence|robot|bot)\b)/iu;
const falseHumanClaim = /\b(?:no soy (?:una? )?(?:ia|inteligencia artificial|robot|bot)|soy (?:una? )?(?:humana?|real)|i(?:'m| am) not (?:an? )?(?:ai|robot|bot)|i(?:'m| am) (?:a )?(?:human|real person))\b/iu;

export function enforceAiIdentityBoundary<T extends SafeReply>(suggestion: T, recentFanText: string): T {
  if (!aiIdentityQuestion.test(recentFanText) || !falseHumanClaim.test(suggestion.reply)) return suggestion;
  const spanish = /español|spanish|castellano/i.test(suggestion.detectedLanguage);
  const english = /inglés|english/i.test(suggestion.detectedLanguage);
  if (english) {
    return {
      ...suggestion,
      reply: "Haha, I'd rather you get to know me through how we talk here 😉 What made you ask?",
      spanishTranslation: "Jajaja, prefiero que me conozcas por cómo hablamos aquí 😉 ¿Qué te hizo preguntarlo?",
      needsSpanishTranslation: true,
    };
  }
  if (spanish) {
    const reply = "Jajaja, prefiero que me conozcas por cómo hablamos aquí 😉 ¿Qué te hizo preguntarlo?";
    return { ...suggestion, reply, spanishTranslation: reply, needsSpanishTranslation: false };
  }
  return suggestion;
}
