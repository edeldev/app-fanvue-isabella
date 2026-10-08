const spanishWords = new Set([
  "a", "al", "algo", "amor", "bebé", "bebe", "bien", "buen", "buenas", "buenos", "como", "con", "cuando", "de", "del", "día", "dia", "donde", "el", "ella", "en", "encanta", "eres", "es", "esta", "foto", "fotos", "gracias", "gusta", "hermosa", "hermoso", "hola", "la", "las", "linda", "lindo", "lo", "los", "me", "mi", "mucho", "muy", "no", "noche", "para", "pero", "por", "porque", "puedes", "que", "quieres", "quiero", "si", "tarde", "te", "tengo", "ti", "tu", "un", "una", "y", "ya", "yo",
]);

const foreignSignals = new Set([
  "and", "are", "beautiful", "but", "can", "do", "for", "hello", "hey", "how", "i", "is", "like", "love", "me", "my", "not", "of", "please", "see", "thanks", "that", "the", "this", "to", "want", "what", "with", "you", "your",
  "bonjour", "merci", "oui", "pour", "avec", "vous", "je", "moi",
  "hallo", "danke", "ich", "und", "du",
  "oi", "obrigado", "obrigada", "voce", "você", "com", "quero",
]);

function languageScores(text: string) {
  const trimmed = text.trim();
  if (!trimmed || !/\p{L}/u.test(trimmed)) return { words: 0, spanish: 0, foreign: 0 };
  const words = trimmed.toLocaleLowerCase("es").match(/\p{L}+/gu) ?? [];
  return {
    words: words.length,
    spanish: words.filter((word) => spanishWords.has(word)).length + (/[¿¡ñáéíóúü]/iu.test(trimmed) ? 2 : 0),
    foreign: words.filter((word) => foreignSignals.has(word)).length,
  };
}

export function isConversationPredominantlySpanish(messages: string[]) {
  const score = messages.slice(-30).reduce((total, message) => {
    const current = languageScores(message);
    return { spanish: total.spanish + current.spanish, foreign: total.foreign + current.foreign };
  }, { spanish: 0, foreign: 0 });
  return score.spanish > 0 && score.spanish >= score.foreign;
}

export function shouldOfferSpanishTranslation(text: string, spanishConversation = false) {
  const score = languageScores(text);
  if (!score.words) return false;
  if (score.spanish >= 2 && score.spanish >= score.foreign) return false;
  if (score.foreign >= 2 && score.foreign > score.spanish) return true;
  if (score.spanish > score.foreign) return false;
  if (score.foreign > score.spanish) return true;
  return !spanishConversation && score.words >= 2;
}
