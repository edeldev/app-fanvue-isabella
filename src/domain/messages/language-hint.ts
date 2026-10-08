const spanishWords = new Set([
  "a", "al", "algo", "amor", "bebé", "bebe", "bien", "buen", "buenas", "buenos", "como", "con", "cuando", "de", "del", "día", "dia", "donde", "el", "ella", "en", "encanta", "eres", "es", "esta", "foto", "fotos", "gracias", "gusta", "hermosa", "hermoso", "hola", "la", "las", "linda", "lindo", "lo", "los", "me", "mi", "mucho", "muy", "no", "noche", "para", "pero", "por", "porque", "puedes", "que", "quieres", "quiero", "si", "tarde", "te", "tengo", "ti", "tu", "un", "una", "y", "ya", "yo",
]);

const foreignSignals = new Set([
  "and", "are", "beautiful", "but", "can", "do", "for", "hello", "hey", "how", "i", "is", "like", "love", "me", "my", "not", "of", "please", "see", "thanks", "that", "the", "this", "to", "want", "what", "with", "you", "your",
  "bonjour", "merci", "oui", "pour", "avec", "vous", "je", "moi",
  "hallo", "danke", "ich", "und", "du",
  "oi", "obrigado", "obrigada", "voce", "você", "com", "quero",
]);

export function shouldOfferSpanishTranslation(text: string) {
  const trimmed = text.trim();
  if (!trimmed || !/\p{L}/u.test(trimmed)) return false;
  const words = trimmed.toLocaleLowerCase("es").match(/\p{L}+/gu) ?? [];
  const spanishScore = words.filter((word) => spanishWords.has(word)).length + (/[¿¡ñáéíóúü]/iu.test(trimmed) ? 2 : 0);
  const foreignScore = words.filter((word) => foreignSignals.has(word)).length;
  if (spanishScore >= 2 || (spanishScore >= 1 && foreignScore === 0)) return false;
  return foreignScore > 0 || words.length >= 2;
}
