type SafeReply = {
  reply: string;
  spanishTranslation: string;
  needsSpanishTranslation: boolean;
  detectedLanguage: string;
};

const aiIdentityQuestion = /(?:\b(?:eres|sos|es usted|are you|you are|voce e|tu es|vous etes|sei|bist du|sind sie)\b.{0,40}\b(?:ia|ai|inteligencia artificial|artificial intelligence|intelligence artificielle|kunstliche intelligenz|robot|robo|bot)\b)|(?:\b(?:ia|ai|robot|robo|bot)\b.{0,25}\b(?:respondiendo|responding|respondendo|repond|schreibt)\b)/iu;
const realIdentityQuestion = /\b(?:eres|sos|es usted|are you|you are|voce e|tu es|vous etes|sei|bist du|sind sie)\b.{0,35}\b(?:real|reales|persona real|human|humano|humaine|humain|echt|wirklich|vero|vera|reel|reelle)\b/iu;
const spanishReply = "Uso un asistente de IA para redactar, pero reviso personalmente los mensajes antes de enviarlos. ¿Qué te hizo preguntarlo?";
const spanishAiProfileReply = "Sí, esta cuenta usa IA y Fanvue la identifica con la etiqueta AI. Los mensajes se revisan antes de enviarse. ¿Qué te gustaría saber?";
const translatedReplies: Array<{ language: RegExp; reply: string }> = [
  { language: /ingl[eé]s|english/i, reply: "I use an AI writing assistant, but I personally review messages before sending them. What made you ask?" },
  { language: /portugu[eê]s|portuguese/i, reply: "Uso um assistente de IA para escrever, mas reviso pessoalmente as mensagens antes de enviá-las. Por que você perguntou?" },
  { language: /franc[eê]s|french|fran[cç]ais/i, reply: "J'utilise un assistant IA pour rédiger, mais je relis personnellement les messages avant de les envoyer. Pourquoi cette question ?" },
  { language: /alem[aá]n|german|deutsch/i, reply: "Ich nutze einen KI-Schreibassistenten, prüfe die Nachrichten aber persönlich, bevor ich sie sende. Warum fragst du?" },
  { language: /italiano|italian/i, reply: "Uso un assistente IA per scrivere, ma rivedo personalmente i messaggi prima di inviarli. Come mai me lo chiedi?" },
];
const aiProfileReplies: Array<{ language: RegExp; reply: string }> = [
  { language: /ingl[eé]s|english/i, reply: "Yes, this account uses AI and Fanvue marks it with an AI label. Messages are reviewed before they are sent. What would you like to know?" },
  { language: /portugu[eê]s|portuguese/i, reply: "Sim, esta conta usa IA e a Fanvue a identifica com a etiqueta AI. As mensagens são revisadas antes do envio. O que você gostaria de saber?" },
  { language: /franc[eê]s|french|fran[cç]ais/i, reply: "Oui, ce compte utilise l’IA et Fanvue l’identifie avec le label AI. Les messages sont relus avant l’envoi. Que souhaites-tu savoir ?" },
  { language: /alem[aá]n|german|deutsch/i, reply: "Ja, dieses Konto nutzt KI und Fanvue kennzeichnet es mit dem AI-Label. Nachrichten werden vor dem Senden geprüft. Was möchtest du wissen?" },
  { language: /italiano|italian/i, reply: "Sì, questo account usa l'IA e Fanvue lo identifica con l'etichetta AI. I messaggi vengono controllati prima dell'invio. Cosa vorresti sapere?" },
];
export function enforceAiIdentityBoundary<T extends SafeReply>(suggestion: T, recentFanText: string, aiProfileLabelConfirmed = false): T {
  const normalizedFanText = recentFanText.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (!aiIdentityQuestion.test(normalizedFanText) && !(aiProfileLabelConfirmed && realIdentityQuestion.test(normalizedFanText))) return suggestion;
  const spanish = /español|spanish|castellano/i.test(suggestion.detectedLanguage);
  const spanishAnswer = aiProfileLabelConfirmed ? spanishAiProfileReply : spanishReply;
  if (spanish) {
    return { ...suggestion, reply: spanishAnswer, spanishTranslation: spanishAnswer, needsSpanishTranslation: false };
  }
  const replies = aiProfileLabelConfirmed ? aiProfileReplies : translatedReplies;
  const reply = replies.find(({ language }) => language.test(suggestion.detectedLanguage))?.reply;
  return { ...suggestion, reply: reply ?? (aiProfileLabelConfirmed ? aiProfileReplies[0].reply : "I use an AI writing assistant, but I personally review messages before sending them. What made you ask?"), spanishTranslation: spanishAnswer, needsSpanishTranslation: true };
}
