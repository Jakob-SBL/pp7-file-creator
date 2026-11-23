const BOOKS = [
  '1. Mose','2. Mose','3. Mose','4. Mose','5. Mose','Josua','Richter','Rut','1. Samuel','2. Samuel','1. Könige','2. Könige',
  '1. Chronik','2. Chronik','Esra','Nehemia','Ester','Hiob','Psalm','Psalmen','Sprüche','Prediger','Hohelied','Jesaja','Jeremia',
  'Klagelieder','Hesekiel','Daniel','Hosea','Joel','Amos','Obadja','Jona','Micha','Nahum','Habakuk','Zefanja','Haggai','Sacharja','Maleachi',
  'Matthäus','Markus','Lukas','Johannes','Apostelgeschichte','Römer','1. Korinther','2. Korinther','Galater','Epheser','Philipper','Kolosser',
  '1. Thessalonicher','2. Thessalonicher','1. Timotheus','2. Timotheus','Titus','Philemon','Hebräer','Jakobus','1. Petrus','2. Petrus',
  '1. Johannes','2. Johannes','3. Johannes','Judas','Offenbarung',
  'Genesis','Exodus','Leviticus','Numbers','Deuteronomy','Joshua','Judges','Ruth','1 Samuel','2 Samuel','1 Kings','2 Kings',
  '1 Chronicles','2 Chronicles','Ezra','Nehemiah','Esther','Job','Psalms','Proverbs','Ecclesiastes','Song of Solomon','Isaiah','Jeremiah',
  'Lamentations','Ezekiel','Daniel','Hosea','Joel','Amos','Obadiah','Jonah','Micah','Nahum','Habakkuk','Zephaniah','Haggai','Zechariah','Malachi',
  'Matthew','Mark','Luke','John','Acts','Romans','1 Corinthians','2 Corinthians','Galatians','Ephesians','Philippians','Colossians',
  '1 Thessalonians','2 Thessalonians','1 Timothy','2 Timothy','Titus','Philemon','Hebrews','James','1 Peter','2 Peter','1 John','2 John','3 John','Jude','Revelation',
  // Häufige deutsche Abkürzungen, wie sie in E-Mails hinter einem Bibelzitat stehen.
  'Joh','Joh.','1. Sam','1 Sam','1Sam','2. Sam','2 Sam','2Sam','1. Kor','1 Kor','1Kor','2. Kor','2 Kor','2Kor',
  'Mt','Mk','Lk','Apg','Röm','Ps','Jes','Offb'
 ];

const BOOK_ABBREVIATIONS = [
  ['1. Sam','1. Samuel'],['1 Sam','1. Samuel'],['1Sam','1. Samuel'],
  ['2. Sam','2. Samuel'],['2 Sam','2. Samuel'],['2Sam','2. Samuel'],
  ['1. Kor','1. Korinther'],['1 Kor','1. Korinther'],['1Kor','1. Korinther'],
  ['2. Kor','2. Korinther'],['2 Kor','2. Korinther'],['2Kor','2. Korinther'],
  ['1. Thess','1. Thessalonicher'],['1 Thess','1. Thessalonicher'],
  ['2. Thess','2. Thessalonicher'],['2 Thess','2. Thessalonicher'],
  ['1. Tim','1. Timotheus'],['1 Tim','1. Timotheus'],
  ['2. Tim','2. Timotheus'],['2 Tim','2. Timotheus'],
  ['1. Petr','1. Petrus'],['1 Petr','1. Petrus'],
  ['2. Petr','2. Petrus'],['2 Petr','2. Petrus'],
  ['1. Joh','1. Johannes'],['1 Joh','1. Johannes'],
  ['2. Joh','2. Johannes'],['2 Joh','2. Johannes'],
  ['3. Joh','3. Johannes'],['3 Joh','3. Johannes'],
  ['Joh','Johannes'],['Mt','Matthäus'],['Matth','Matthäus'],
  ['Mk','Markus'],['Lk','Lukas'],['Apg','Apostelgeschichte'],
  ['Röm','Römer'],['Gal','Galater'],['Eph','Epheser'],['Phil','Philipper'],
  ['Kol','Kolosser'],['Ps','Psalmen'],['Spr','Sprüche'],['Pred','Prediger'],
  ['Hld','Hohelied'],['Jes','Jesaja'],['Jer','Jeremia'],['Hes','Hesekiel'],
  ['Dan','Daniel'],['Hos','Hosea'],['Obd','Obadja'],['Mi','Micha'],
  ['Nah','Nahum'],['Hab','Habakuk'],['Zef','Zefanja'],['Hag','Haggai'],
  ['Sach','Sacharja'],['Mal','Maleachi'],['Offb','Offenbarung']
];
const abbreviationPattern = BOOK_ABBREVIATIONS
  .map(([short]) => short.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .sort((a,b) => b.length-a.length).join('|');

function expandBookAbbreviation(reference) {
  const match = String(reference ?? '').match(new RegExp(`^(${abbreviationPattern})\\.?(?=\\s*\\d)`, 'i'));
  if (!match) return reference;
  const entry = BOOK_ABBREVIATIONS.find(([short]) => short.toLocaleLowerCase('de-DE') === match[1].toLocaleLowerCase('de-DE'));
  if (!entry) return reference;
  return `${entry[1]}${reference.slice(match[0].length)}`;
}

BOOKS.push(...BOOK_ABBREVIATIONS.flatMap(([short]) => [short, `${short}.`]));

const bookPattern = BOOKS.map(x => {
  const numbered = x.match(/^([1-5])\.\s+(.+)$/);
  if (numbered) return `${numbered[1]}\\.\\s*${numbered[2].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`;
  return x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}).sort((a,b)=>b.length-a.length).join('|');
const referenceCore = `\\b(?:${bookPattern})\\s+\\d+(?:\\s*[:,.]\\s*\\d+[a-b]?(?:\\s*[-–]\\s*\\d+[a-b]?)?(?:\\s*[,;+]\\s*\\d+[a-b]?(?:\\s*[-–]\\s*\\d+[a-b]?)?)*)?`;
// Unterstützt sowohl „Joh 15,16“ als auch „(Joh 15,16)“ sowie Referenzen
// vor dem Text mit Übersetzungsangabe wie „(NGÜ)“.
const translationSuffix = '(?:\\s+(?:NGÜ|NIV|ELB|HFA|SCH|LUT(?:HER)?(?:\\s*20\\d{2})?|GNB|NEÜ|NLB|EU|EÜ|SLT|ZB|REB))?';
const referenceRegex = new RegExp(`(?:\\(\\s*${referenceCore}\\s*\\)|${referenceCore}(?:\\s*\\([^)]{2,12}\\))?${translationSuffix})`, 'i');

// Vorläufiger Richtwert für das aktuelle Bibelstellen-Theme. Der genaue Platz
// hängt auch von Zeilenumbrüchen und der PP7-Darstellung ab; deshalb bleibt
// jeder Vers ungeteilt und ein einzelner langer Vers darf den Richtwert übersteigen.
// Konservativer als die frühere 360-Zeichen-Grenze: Die tatsächliche
// Zeilenbreite hängt von Schriftbild und Wortlängen ab. Der Wert ist bewusst
// mit Sicherheitsabstand gewählt, damit PP7-Textfelder nicht bis an den Rand
// gefüllt werden. Verse bleiben weiterhin ungeteilt.
const BIBLE_SLIDE_TEXT_BUDGET = 360;
const BIBLE_VERSE_CHUNK_BUDGET = 200;

function clean(value) {
  return value.replace(/^\s*(?:[-*•▪]|\d+\s*\\?[.)])\s*/, '').trim();
}

// Entfernt ausschließlich numerische Quellenmarker wie [4] oder [16].
// Auslassungszeichen in eckigen Klammern ([...]) bleiben ausdrücklich erhalten.
export function removeNumericBracketMarkers(value) {
  return String(value ?? '').replace(/\[\d+\]/g, '');
}
function normalizeAuthor(value) {
  return String(value ?? '')
    .trim()
    .replace(/^[–—-]\s*/, '')
    .replace(/^(?:Zitat\s+von|von)\s+/i, '')
    .replace(/[,:;]+$/, '')
    .trim();
}

function authorCandidate(value) {
  const original = String(value ?? '').trim();
  if (!original || original.length > 70 || original.length < 3 || /[.!?;]$/.test(original) || referenceRegex.test(original)) return false;
  // Ein vollständig in Anführungszeichen gesetzter Titel ist kein Autorenname.
  if (/^(?:"|„|“|«|')/.test(original) && /(?:"|“|”|»|')$/.test(original)) return false;

  const explicitAttribution = /^(?:Zitat\s+von|von)\s+/i.test(original);
  const name = normalizeAuthor(original);
  const words = name.split(/\s+/);
  if (words.length < 1 || words.length > 7) return false;

  // Nur echte Namensbestandteile zulassen: z. B. „Martin Luther“,
  // „C. S. Lewis“, „Ludwig van Beethoven“ oder „Corrie ten Boom“.
  // Ganze Satzteile wie „Was David uns ...“ scheitern an den Kleinbuchstaben.
  const particles = new Set(['von', 'van', 'der', 'den', 'de', 'da', 'di', 'la', 'le', 'ten', 'zu', 'zum', 'zur', 'the', 'of']);
  const nameParts = words.filter(word => !particles.has(word.toLocaleLowerCase('de-DE')));
  const isNamePart = word => /^(?:[A-ZÄÖÜẞ][\p{Ll}][\p{L}'’.-]*|(?:[A-ZÄÖÜẞ]\.){1,4})$/u.test(word);
  if (!words.every(word => particles.has(word.toLocaleLowerCase('de-DE')) || isNamePart(word))) return false;
  return explicitAttribution ? nameParts.length >= 1 : nameParts.length >= 2;
}
function makePoint(content) {
  return { id: crypto.randomUUID(), type: 'point', content: clean(content), warning: false };
}
function makeBible(reference, text, passageGroupId = null) {
  return { id: crypto.randomUUID(), type: 'bible', reference: reference.trim(), content: text.trim(), warning: false, ...(passageGroupId ? { passageGroupId } : {}) };
}
function makeQuote(author, content) {
  return { id: crypto.randomUUID(), type: 'quote', author: normalizeAuthor(author), content: content.trim(), warning: false };
}

// Ein in Anführungszeichen gesetzter Predigttitel ist eine eigene Punktfolie.
// Nummerierte Überschriften direkt danach sind ebenfalls eigene Punktfolien,
// auch wenn E-Mail-Formatierungen den Absatzabstand beim Kopieren verlieren.
function isQuotedTitle(value) {
  const line = String(value ?? '').trim();
  return /^(?:\"[^\"\n]{2,}\"|„[^“\n]{2,}“|“[^”\n]{2,}”|«[^»\n]{2,}»)$/.test(line);
}
function isNumberedPoint(value) {
  const text = String(value ?? '').trim();
  if (referenceRegex.test(text)) return false; // „1. Samuel 16,11-13“ ist eine Bibelreferenz, kein Listenpunkt.
  return /^\s*\d+\s*\\?[.)]\s*[A-ZÄÖÜẞ„“«\"]/.test(text);
}

function getVerseRange(reference) {
  // Die erste Versangabe der Referenz ist maßgeblich (z. B. 10:1-4).
  const match = reference.match(/[,:.]\s*(\d+)\s*(?:[-–]|\+)\s*(\d+)/);
  if (!match) return null;
  const first = Number(match[1]);
  const last = Number(match[2]);
  if (!Number.isInteger(first) || !Number.isInteger(last) || last <= first || last - first > 100) return null;
  return { first, last };
}

function extractVerses(text, reference) {
  if (!text.trim()) return null;
  const range = getVerseRange(reference);

  // Wenn die Referenz nur ein Kapitel nennt (z. B. „Lukas 18“), kann die
  // Versfolge aus den expliziten Versnummern im Text abgeleitet werden.
  // Bei einer Bereichsreferenz bleibt deren erste Versnummer maßgeblich.
  const leadingMarker = text.trim().match(/^(\d{1,3})\s*(?=[\p{L}„“»›\x22\x27(])/u);
  const firstVerse = range?.first ?? (leadingMarker ? Number(leadingMarker[1]) : null);
  if (!Number.isInteger(firstVerse)) return null;

  // Die erste Versnummer steht häufig direkt am Textanfang. Sie wird einmal
  // entfernt und beim Zusammenstellen der Folien wieder vorangestellt.
  const firstVerseMarker = new RegExp(`^${firstVerse}\\s*(?=[\\p{L}„“»›\\x22\\x27(])`, 'u');
  text = text.trim().replace(firstVerseMarker, '');

  const boundaries = [];
  let cursor = 0;
  const lastVerse = range?.last ?? Math.min(firstVerse + 100, 200);
  for (let verse = firstVerse + 1; verse <= lastVerse; verse++) {
    const remaining = text.slice(cursor);
    // Versnummern können direkt nach Satzzeichen oder schließenden
    // Anführungszeichen stehen, z. B. „…?« 19 »Warum …“.
    const marker = new RegExp(`(^|[\\s,.;:!?—–»”\\-])(${verse})(?=\\s*[\\p{L}„“»›\\x22\\x27(])`, 'u');
    const found = marker.exec(remaining);
    if (!found) {
      // Bei expliziten Bereichen darf eine fehlende Nummer übersprungen
      // werden (E-Mail-Auszüge sind manchmal unvollständig). Bei automatisch
      // erkannten Kapiteltexten endet die Folge an der ersten Lücke.
      if (!range) break;
      continue;
    }
    const markerStart = cursor + found.index + found[1].length;
    const markerEnd = markerStart + String(verse).length;
    boundaries.push({ start: markerStart, end: markerEnd, verse });
    cursor = markerEnd;
  }

  const verses = [];
  let start = 0;
  let currentVerse = firstVerse;
  for (const boundary of boundaries) {
    const before = text.slice(start, boundary.start).trim();
    if (before) verses.push(`${currentVerse} ${before}`);
    currentVerse = boundary.verse;
    start = boundary.end;
  }
  const last = text.slice(start).trim();
  if (last) verses.push(`${currentVerse} ${last}`);
  return verses.length ? verses : null;
}

function splitLongVerse(verse, maxChars = BIBLE_VERSE_CHUNK_BUDGET) {
  if (verse.length <= maxChars) return [verse];
  const match = verse.match(/^(\d{1,3})\s+([\s\S]*)$/);
  const number = match?.[1] ?? '';
  const body = match?.[2] ?? verse;
  // Erst an Satzgrenzen teilen; sehr lange Einzelsätze anschließend an
  // Wortgrenzen aufteilen. Kein Wort und kein Satzzeichen wird verworfen.
  const sentences = body.split(/(?<=[.!?;:])\s+/).filter(Boolean);
  const chunks = [];
  let current = '';
  const push = () => { if (current) { chunks.push(current); current = ''; } };
  for (const sentence of sentences.length ? sentences : [body]) {
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (candidate.length <= maxChars - (number ? number.length + 1 : 0)) {
      current = candidate;
      continue;
    }
    push();
    if (sentence.length <= maxChars - (number ? number.length + 1 : 0)) {
      current = sentence;
      continue;
    }
    let wordChunk = '';
    for (const word of sentence.split(/\s+/)) {
      const next = wordChunk ? `${wordChunk} ${word}` : word;
      if (wordChunk && next.length > maxChars - (number ? number.length + 1 : 0)) {
        chunks.push(wordChunk);
        wordChunk = word;
      } else wordChunk = next;
    }
    current = wordChunk;
    push();
  }
  push();
  return chunks.map((chunk, index) => `${index === 0 && number ? `${number} ` : ''}${chunk}`);
}

function groupTextWithoutVerseBoundaries(verses, maxChars = BIBLE_SLIDE_TEXT_BUDGET) {
  // Lange Abschnitte werden an sinnvollen sprachlichen Grenzen geteilt.
  // Versenden haben Vorrang, danach Satzzeichen (Punkt/Komma usw.). Nur wenn
  // ein einzelner Abschnitt sonst zu lang würde, dienen Wortgrenzen als Fallback.
  const text = verses.join(' ').replace(/\s+/g, ' ').trim();
  if (!text) return [];

  const boundaries = new Map();
  const addBoundary = (position, penalty) => {
    const pos = text.slice(0, position).trimEnd().length;
    if (pos <= 0 || pos >= text.length) return;
    const previous = boundaries.get(pos);
    if (previous === undefined || penalty < previous) boundaries.set(pos, penalty);
  };

  // Versenden sind bevorzugte Trennstellen.
  let offset = 0;
  for (const verse of verses.slice(0, -1)) {
    offset += verse.length;
    addBoundary(offset, 0);
    offset += 1; // Leerzeichen zwischen den Versen
  }

  // Satz- und Teilsatzgrenzen: Punkt/Frage-/Ausrufezeichen vor Komma.
  for (const match of text.matchAll(/[.!?;:](?=\s|$)|,(?=\s|$)/g)) {
    const punctuationEnd = match.index + 1;
    addBoundary(punctuationEnd, /[,;]/.test(match[0]) ? 2 : 1);
  }

  // Wortgrenzen bleiben als Notlösung verfügbar, damit auch sehr lange
  // Sätze vollständig und ohne abgeschnittene Wörter aufgeteilt werden.
  for (const match of text.matchAll(/\s+/g)) addBoundary(match.index, 8);

  const points = [{ position: 0, penalty: 0 }, ...[...boundaries.entries()]
    .map(([position, penalty]) => ({ position, penalty }))
    .sort((a, b) => a.position - b.position)];
  points.push({ position: text.length, penalty: 0 });

  // Dynamische Programmierung: zuerst minimale Folienzahl, dann möglichst
  // gleichmäßige Textmengen; sinnvolle Satz-/Versgrenzen werden bevorzugt.
  const best = Array(points.length).fill(null);
  const endIndex = points.length - 1;
  best[endIndex] = { count: 0, cost: 0, next: -1 };
  for (let i = endIndex - 1; i >= 0; i--) {
    for (let j = i + 1; j <= endIndex; j++) {
      const start = points[i].position;
      const finish = points[j].position;
      const length = finish - start;
      if (length > maxChars) break;
      if (!best[j]) continue;
      const candidate = {
        count: best[j].count + 1,
        cost: best[j].cost + (length * length) + (j === endIndex ? 0 : points[j].penalty * 1800),
        next: j
      };
      if (!best[i] || candidate.count < best[i].count ||
          (candidate.count === best[i].count && candidate.cost < best[i].cost)) best[i] = candidate;
    }
  }

  if (!best[0]) {
    // Extrem lange Einzelpassagen: die sichere Wortgrenzen-Aufteilung.
    const chunks = [];
    let current = '';
    for (const word of text.split(/\s+/)) {
      const next = current ? `${current} ${word}` : word;
      if (current && next.length > maxChars) {
        chunks.push(current);
        current = word;
      } else current = next;
    }
    if (current) chunks.push(current);
    return chunks;
  }

  const groups = [];
  let index = 0;
  while (index !== endIndex) {
    const next = best[index].next;
    groups.push(text.slice(points[index].position, points[next].position).trim());
    index = next;
  }
  return groups;
}

function groupVerses(verses, maxChars = BIBLE_SLIDE_TEXT_BUDGET) {
  if (!verses?.length) return [];
  // Bei Bibelabschnitten mit mindestens vier erkannten Versen darf eine
  // Folie mitten im Vers enden bzw. die nächste mitten im Vers beginnen.
  // So wird die verfügbare Textfläche gleichmäßiger genutzt.
  if (verses.length >= 4) return groupTextWithoutVerseBoundaries(verses, maxChars);
  // Bei kürzeren Abschnitten bleiben Versgrenzen bevorzugte Trennstellen.
  // Auch ein einzelner überlanger Vers wird bei Bedarf an Wortgrenzen geteilt.
  verses = verses.flatMap(verse => splitLongVerse(verse));
  const n = verses.length;
  // Dynamische Aufteilung: zuerst möglichst wenige Folien, innerhalb dieser
  // Lösung möglichst ausgewogene Textmengen. Versgrenzen bleiben unangetastet.
  const best = Array(n + 1).fill(null);
  best[n] = { count: 0, cost: 0, groups: [] };
  for (let i = n - 1; i >= 0; i--) {
    let length = 0;
    for (let j = i; j < n; j++) {
      length += (j > i ? 1 : 0) + verses[j].length;
      if (length > maxChars && j > i) break;
      const tail = best[j + 1];
      if (!tail) continue;
      const candidate = {
        count: tail.count + 1,
        cost: tail.cost + length * length,
        groups: [verses.slice(i, j + 1).join(' ').trim(), ...tail.groups]
      };
      if (!best[i] || candidate.count < best[i].count || (candidate.count === best[i].count && candidate.cost < best[i].cost)) best[i] = candidate;
    }
  }
  return best[0]?.groups ?? [verses.join(' ')];
}

function parseBlock(block) {
  const lines = block.split(/\n+/).map(x => x.trim()).filter(Boolean);
  if (!lines.length) return [];
  const joined = lines.join('\n');
  const refMatch = joined.match(referenceRegex);
  if (refMatch) {
    const rawReference = refMatch[0];
    // Äußere Klammern einer nachgestellten Referenz entfernen; eine
    // Übersetzungsangabe wie (NGÜ) bei vorangestellter Referenz bleibt erhalten.
    const wrappedReference = /^\(\s*.+\s*\)$/.test(rawReference);
    const extractedReference = wrappedReference ? rawReference.replace(/^\(\s*|\s*\)$/g, '') : rawReference;
    const reference = expandBookAbbreviation(extractedReference).replace(/^([1-5])\.\s*(?=[\p{L}])/u, '$1. ');
    // Entfernt auch eine vorangestellte E-Mail-Nummerierung wie „2. 1. Korinther …“.
    const beforeReference = joined.slice(0, refMatch.index);
    const afterReference = joined.slice(refMatch.index + rawReference.length);
    // Bibeltexte aus E-Mails sind häufig so formatiert, dass jeder Vers
    // in einer eigenen Zeile steht. Für den Editor sollen diese Zeilenumbrüche
    // verschwinden; die Versnummern bleiben dabei erhalten, damit lange
    // Passagen weiterhin zuverlässig an Versgrenzen aufgeteilt werden können.
    const content = clean(`${beforeReference}${afterReference}`
      .replace(/^\s*[:–—-]?\s*/, '')
      .replace(/\s*\n\s*/g, ' ')
      .replace(/[ \t]{2,}/g, ' '));
    const verses = extractVerses(content, reference);
    if (verses) {
      const parts = groupVerses(verses);
      const passageGroupId = parts.length > 1 ? crypto.randomUUID() : null;
      return parts.map(part => makeBible(reference, part, passageGroupId));
    }
    return [makeBible(reference, content)];
  }
  const inline = joined.match(/^(.{2,70}?)\s*[:–—-]\s*(\S[\s\S]*)$/);
  if (inline && authorCandidate(inline[1])) return [makeQuote(inline[1], inline[2])];
  // Häufige Zitatform: erst der Text, danach „– Vorname Nachname“.
  const trailingAttribution = joined.match(/^([\s\S]*\S)\s+[–—-]\s+(.{2,70})$/);
  if (trailingAttribution && authorCandidate(trailingAttribution[2])) {
    return [makeQuote(trailingAttribution[2], trailingAttribution[1])];
  }
  if (lines.length >= 2) {
    if (authorCandidate(lines[0])) return [makeQuote(lines[0], lines.slice(1).join('\n'))];
    if (authorCandidate(lines[lines.length - 1])) return [makeQuote(lines[lines.length - 1], lines.slice(0, -1).join('\n'))];
  }
  return [makePoint(joined)];
}

function decodeEmailEntities(value) {
  const named = { nbsp: ' ', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' };
  return String(value ?? '').replace(/&(#x[\da-f]+|#\d+|nbsp|amp|quot|apos|lt|gt);/gi, (entity, code) => {
    if (code[0] !== '#') return named[code.toLowerCase()] ?? entity;
    const number = code[1].toLowerCase() === 'x' ? Number.parseInt(code.slice(2), 16) : Number.parseInt(code.slice(1), 10);
    if (!Number.isInteger(number) || number < 0 || number > 0x10ffff || (number >= 0xd800 && number <= 0xdfff)) return entity;
    // HTML-kopierte E-Mails enthalten häufig NBSP als &#xA0;; als Trennraum normalisieren.
    return number === 0xa0 ? ' ' : String.fromCodePoint(number);
  });
}

function parseBaptismBlock(text) {
  // E-Mail-Kopien können mehrere Tauf-Einträge ohne Leerzeilen oder sogar
  // vollständig in einer einzigen Textzeile enthalten. Deshalb an jedem
  // „Name:“ beginnen und den jeweiligen Abschnitt bis zum nächsten Namen lesen.
  // Manche Mail-Clients kopieren formatierte Inhalte als HTML-Zeichenreferenzen
  // (z. B. &#xA0; für Leerzeichen oder &#x44; für D). Diese vor dem Parsen dekodieren.
  const normalized = decodeEmailEntities(text).replace(/\*\*/g, '').replace(/\r\n?/g, '\n').trim();
  const nameMarkers = [...normalized.matchAll(/(?:^|\s)Name\s*:\s*/gi)];
  if (!nameMarkers.length) return null;

  const slides = [];
  const prefix = normalized.slice(0, nameMarkers[0].index).trim();
  if (prefix) slides.push(...parseBlock(prefix));
  for (let i = 0; i < nameMarkers.length; i++) {
    const marker = nameMarkers[i];
    const segmentStart = marker.index + marker[0].length;
    const segmentEnd = i + 1 < nameMarkers.length ? nameMarkers[i + 1].index : normalized.length;
    const segment = normalized.slice(segmentStart, segmentEnd).trim();
    const verseLabel = segment.match(/\bVers\s*:\s*/i);
    if (!verseLabel) continue;

    const name = segment.slice(0, verseLabel.index).trim().replace(/[,:;]+$/, '').trim();
    if (!name) continue;

    const afterVerseLabel = segment.slice(verseLabel.index + verseLabel[0].length).trim();
    const refMatch = afterVerseLabel.match(referenceRegex);
    let reference = '';
    let content = '';
    if (refMatch) {
      reference = expandBookAbbreviation(refMatch[0]).replace(/^([1-5])\.\s*(?=[\p{L}])/u, '$1. ');
      content = afterVerseLabel.slice(refMatch.index + refMatch[0].length);
    } else if (!/^\(?\s*tbd\s*\)?$/i.test(afterVerseLabel)) {
      // Wenn nach „Vers:“ kein Referenzformat erkannt wird, bleibt der
      // restliche Text erhalten, statt ihn stillschweigend zu verwerfen.
      content = afterVerseLabel;
    }

    content = content.replace(/^\s*[:–—-]?\s*/, '').replace(/\s+/g, ' ')
      .replace(/^[“„"]|[”"“]$/g, '').trim();
    slides.push({ id: crypto.randomUUID(), type: 'baptism', name, reference, content, warning: false });
  }
  return slides.length ? slides : null;
}

export function parseSermonEmail(text) {
  text = removeNumericBracketMarkers(text);
  if (!text || !text.trim()) return [];
  const baptism = parseBaptismBlock(text);
  if (baptism) return baptism;
  const blocks = text.replace(/\r\n?/g, '\n').trim().split(/\n\s*\n+/).map(x => x.trim()).filter(Boolean);
  // Falls die Bibelstellenangabe in der E-Mail als eigener Absatz direkt
  // unter dem Bibeltext steht, wird sie mit diesem Textblock verbunden.
  for (let i = 1; i < blocks.length; i++) {
    const match = blocks[i].match(referenceRegex);
    const isReferenceOnlyBlock = match && match.index === 0 && match[0].length === blocks[i].length;
    if (isReferenceOnlyBlock && !referenceRegex.test(blocks[i - 1])) {
      blocks[i - 1] = `${blocks[i - 1]} ${blocks[i]}`;
      blocks.splice(i, 1);
      i--;
    }
  }
  const slides = [];
  for (let i = 0; i < blocks.length; i++) {
    const current = blocks[i];
    const next = blocks[i + 1];

    // Nummerierte Überschriften sind ein eindeutiges Signal für einen
    // Stichpunkt. Diese Regel muss VOR der allgemeinen Autoren-/Zitatlogik
    // greifen: Ein unzitierter Predigttitel wie „Was David uns ...“ erfüllt
    // sonst authorCandidate() und wird fälschlich mit dem Punkt als Zitat gepaart.
    const currentLines = current.split(/\n+/).map(line => line.trim()).filter(Boolean);
    if (currentLines.length === 2 && isNumberedPoint(currentLines[1])) {
      slides.push(makePoint(currentLines[0]), makePoint(clean(currentLines[1])));
      continue;
    }

    // Titel und nummerierter Punkt können auch durch einen Leerabsatz
    // getrennt sein. Der Punkt-Marker hat Vorrang vor jeder Zitat-Erkennung.
    if (next && isNumberedPoint(next) && !referenceRegex.test(current)) {
      slides.push(makePoint(current), makePoint(clean(next)));
      i++;
      continue;
    }

    if (authorCandidate(current) && next && !referenceRegex.test(next) && !authorCandidate(next)) {
      slides.push(makeQuote(current, next));
      i++;
      continue;
    }
    if (next && authorCandidate(next) && !referenceRegex.test(current) && !authorCandidate(current)) {
      slides.push(makeQuote(next, current));
      i++;
      continue;
    }
    slides.push(...parseBlock(current));
  }
  return slides;
}
