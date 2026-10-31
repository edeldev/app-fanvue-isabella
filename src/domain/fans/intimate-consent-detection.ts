export type ConsentConversationMessage = {
  id: string;
  role: "fan" | "creator";
  text: string | null;
  sentAt: Date;
};

export type IntimateConsentDetection = {
  decision: "GRANTED" | "REVOKED" | "AMBIGUOUS" | "NONE";
  evidenceMessageId: string | null;
  reason: string;
};

const ADULT_SUBJECT = /\b(contenido (?:adulto|intimo|explicito|\+?18)|para adultos|desnud[oa]s?|nudes?|nsfw|sin ropa|fotos? (?:intimas?|explicitas?|desnud[oa]s?)|videos? (?:intimos?|explicitos?|desnud[oa]s?)|nudez|adult content|explicit content|intimate content|conteudo adulto|conteudo intimo|sem roupa)\b/;
const CONSENT_QUESTION = /\b(quieres|te gustaria|deseas|me (?:das|das tu) (?:permiso|consentimiento)|das tu consentimiento|aceptas|puedo (?:enviarte|mandarte|mostrarte)|want|would you like|may i send|can i send|do you consent|voce quer|quer receber|posso (?:enviar|mandar))\b/;
const EXPLICIT_GRANT = /\b(si(?:,? (?:quiero|acepto|claro|mandame|enviame|puedes|por supuesto|me gustaria))?|quiero|acepto|doy (?:mi )?(?:permiso|consentimiento)|estoy de acuerdo|adelante|mandame|enviame|muestrame|puedes (?:enviarme|mandarme|mostrarme)|yes|i (?:want|consent|agree)|send me|show me|go ahead|sure|sim|aceito|quero|pode (?:enviar|mandar)|manda pra mim)\b/;
const SHORT_GRANT = /^(si|si quiero|claro|acepto|adelante|de acuerdo|por supuesto|puedes|yes|yes please|sure|i agree|go ahead|sim|sim quero|claro que sim|aceito|pode)$/;
const EXPLICIT_REVOKE = /\b(no (?:quiero|acepto|consiento)|no me (?:envies|mandes|muestres)|ya no (?:quiero|me envies|me mandes|me muestres)|retiro (?:mi )?(?:permiso|consentimiento)|detente|para de enviarme|do not send|don't send|i do not (?:want|consent)|i don't (?:want|consent)|stop sending|nao (?:quero|aceito)|nao me (?:envie|mande)|pare de enviar)\b/;
const SHORT_REVOKE = /^(no|no gracias|mejor no|no quiero|para|detente|no thanks|i do not|i don't|stop|nao|nao obrigado|melhor nao|pare)$/;

function normalize(value: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-MX")
    .replace(/[¿?¡!.,;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isSpecificConsentQuestion(text: string) {
  return ADULT_SUBJECT.test(text) && CONSENT_QUESTION.test(text);
}

export function detectIntimateContentConsent(
  messages: ConsentConversationMessage[],
  currentFanMessageId: string,
): IntimateConsentDetection {
  const ordered = [...messages].sort((left, right) => left.sentAt.getTime() - right.sentAt.getTime());
  const currentIndex = ordered.findIndex((message) => message.id === currentFanMessageId && message.role === "fan");
  if (currentIndex < 0) return { decision: "NONE", evidenceMessageId: null, reason: "El mensaje recibido no está en el contexto disponible." };

  const current = ordered[currentIndex];
  const currentText = normalize(current.text);
  if (!currentText) return { decision: "NONE", evidenceMessageId: null, reason: "El mensaje no contiene texto." };

  const priorCreatorMessage = ordered
    .slice(0, currentIndex)
    .reverse()
    .find((message) => message.role === "creator" && current.sentAt.getTime() - message.sentAt.getTime() <= 24 * 60 * 60 * 1_000);
  const followsSpecificQuestion = priorCreatorMessage
    ? isSpecificConsentQuestion(normalize(priorCreatorMessage.text))
    : false;

  if (ADULT_SUBJECT.test(currentText) && EXPLICIT_REVOKE.test(currentText)) {
    return { decision: "REVOKED", evidenceMessageId: current.id, reason: "El fan retiró o negó explícitamente el consentimiento para contenido adulto." };
  }
  if (followsSpecificQuestion && (SHORT_REVOKE.test(currentText) || EXPLICIT_REVOKE.test(currentText))) {
    return { decision: "REVOKED", evidenceMessageId: current.id, reason: "El fan respondió negativamente a una solicitud específica de consentimiento." };
  }
  if (ADULT_SUBJECT.test(currentText) && EXPLICIT_GRANT.test(currentText)) {
    return { decision: "GRANTED", evidenceMessageId: current.id, reason: "El fan solicitó o aceptó explícitamente contenido adulto." };
  }
  if (followsSpecificQuestion && (SHORT_GRANT.test(currentText) || EXPLICIT_GRANT.test(currentText))) {
    return { decision: "GRANTED", evidenceMessageId: current.id, reason: "El fan respondió afirmativamente a una solicitud específica de consentimiento." };
  }
  if (SHORT_GRANT.test(currentText) || SHORT_REVOKE.test(currentText)) {
    return { decision: "AMBIGUOUS", evidenceMessageId: current.id, reason: "La respuesta breve no tiene una pregunta específica de consentimiento como contexto." };
  }
  return { decision: "NONE", evidenceMessageId: null, reason: "No se detectó una decisión explícita sobre contenido adulto." };
}
