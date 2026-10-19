type SafeReply = {
  reply: string;
  spanishTranslation: string;
  needsSpanishTranslation: boolean;
  detectedLanguage: string;
};

const aiIdentityQuestion = /(?:\b(?:eres|sos|es usted|are you|you are|voce e|tu es|vous etes|sei|bist du|sind sie)\b.{0,40}\b(?:ia|ai|inteligencia artificial|artificial intelligence|intelligence artificielle|kunstliche intelligenz|robot|robo|bot)\b)|(?:\b(?:ia|ai|robot|robo|bot)\b.{0,25}\b(?:respondiendo|responding|respondendo|repond|schreibt)\b)/iu;
const spanishReply = "Uso un asistente de IA para redactar, pero reviso personalmente los mensajes antes de enviarlos. ¿Qué te hizo preguntarlo?";
const translatedReplies: Array<{ language: RegExp; reply: string }> = [
  { language: /ingl[eé]s|english/i, reply: "I use an AI writing assistant, but I personally review messages before sending them. What made you ask?" },
  { language: /portugu[eê]s|portuguese/i, reply: "Uso um assistente de IA para escrever, mas reviso pessoalmente as mensagens antes de enviá-las. Por que você perguntou?" },
  { language: /franc[eê]s|french|fran[cç]ais/i, reply: "J'utilise un assistant IA pour rédiger, mais je relis personnellement les messages avant de les envoyer. Pourquoi cette question ?" },
  { language: /alem[aá]n|german|deutsch/i, reply: "Ich nutze einen KI-Schreibassistenten, prüfe die Nachrichten aber persönlich, bevor ich sie sende. Warum fragst du?" },
  { language: /italiano|italian/i, reply: "Uso un assistente IA per scrivere, ma rivedo personalmente i messaggi prima di inviarli. Come mai me lo chiedi?" },
];
export function enforceAiIdentityBoundary<T extends SafeReply>(suggestion: T, recentFanText: string): T {
  const normalizedFanText = recentFanText.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (!aiIdentityQuestion.test(normalizedFanText)) return suggestion;
  const spanish = /español|spanish|castellano/i.test(suggestion.detectedLanguage);
  if (spanish) {
    return { ...suggestion, reply: spanishReply, spanishTranslation: spanishReply, needsSpanishTranslation: false };
  }
  const reply = translatedReplies.find(({ language }) => language.test(suggestion.detectedLanguage))?.reply;
  return { ...suggestion, reply: reply ?? "I use an AI writing assistant, but I personally review messages before sending them. What made you ask?", spanishTranslation: spanishReply, needsSpanishTranslation: true };
}
