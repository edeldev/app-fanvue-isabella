const spanishWords = new Set([
  "a", "al", "algo", "amor", "bebé", "bebe", "bien", "buen", "buenas", "buenos", "como", "cómo", "con", "cuando", "de", "del", "día", "dia", "donde", "el", "ella", "en", "encanta", "eres", "es", "esta", "estás", "foto", "fotos", "gracias", "gusta", "hermosa", "hermoso", "hola", "la", "las", "linda", "lindo", "lo", "los", "me", "mi", "mucho", "muy", "no", "noche", "para", "pero", "por", "porque", "puedes", "qué", "que", "quieres", "quiero", "si", "tarde", "te", "tengo", "ti", "tu", "un", "una", "y", "ya", "yo",
]);

const foreignSignals = new Set([
  "and", "are", "beautiful", "but", "can", "do", "for", "hello", "hey", "how", "i", "is", "like", "love", "me", "my", "not", "of", "please", "see", "thanks", "that", "the", "this", "to", "want", "what", "with", "you", "your",
  "bonjour", "merci", "oui", "pour", "avec", "vous", "je", "moi",
  "hallo", "danke", "ich", "und", "du",
  "oi", "olá", "ola", "obrigado", "obrigada", "voce", "você", "com", "quero",
  "boa", "bom", "noite", "tudo", "bem", "vai", "estou", "saudade", "saudades", "beijo", "beijos", "gostei", "lindíssima",
  "ciao", "grazie", "buongiorno", "buona", "notte", "stai", "salut",
]);

const clearlyNonLatin = /[\p{Script=Cyrillic}\p{Script=Greek}\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Devanagari}]/u;
const strongForeignSignals = new Set([
  "olá", "ola", "boa", "bom", "noite", "tudo", "bem", "vai", "você", "voce", "estou", "saudade", "saudades", "obrigado", "obrigada", "beijo", "beijos", "gostei",
]);

function languageScores(text: string) {
  const trimmed = text.trim();
  if (!trimmed || !/\p{L}/u.test(trimmed)) return { words: 0, spanish: 0, foreign: 0 };
  const words = trimmed.toLocaleLowerCase("es").match(/\p{L}+/gu) ?? [];
  return {
    words: words.length,
    spanish: words.filter((word) => spanishWords.has(word)).length + (/[¿¡ñ]/iu.test(trimmed) ? 2 : 0),
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
  if (clearlyNonLatin.test(text)) return true;
  const words = text.toLocaleLowerCase("es").match(/\p{L}+/gu) ?? [];
  if (score.spanish < 2 && words.some((word) => strongForeignSignals.has(word))) return true;
  if (score.spanish >= 2 && score.spanish >= score.foreign) return false;
  if (score.foreign >= 2 && score.foreign > score.spanish) return true;
  if (score.spanish > score.foreign) return false;
  if (score.foreign > score.spanish) return true;
  if (score.spanish > 0) return !spanishConversation && score.words >= 3;
  // For unknown words, prefer showing an optional action over hiding a foreign message.
  // The translation endpoint makes the final language decision after a click.
  return true;
}
