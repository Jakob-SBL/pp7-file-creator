const RTF_PREFIX = '{\\rtf1';

function readVarint(bytes, offset) {
  let value = 0;
  let shift = 0;
  while (offset < bytes.length) {
    const byte = bytes[offset++];
    value |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) return [value >>> 0, offset];
    shift += 7;
    if (shift > 35) throw new Error('Ungültiger Protobuf-Varint.');
  }
  throw new Error('Unvollständiger Protobuf-Varint.');
}

function writeVarint(value) {
  let n = Number(value) >>> 0;
  const out = [];
  while (n > 0x7f) {
    out.push((n & 0x7f) | 0x80);
    n >>>= 7;
  }
  out.push(n);
  return Uint8Array.from(out);
}

function concatBytes(parts) {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function parseMessage(bytes) {
  const fields = [];
  let offset = 0;
  while (offset < bytes.length) {
    const start = offset;
    let tag;
    [tag, offset] = readVarint(bytes, offset);
    const number = tag >>> 3;
    const wire = tag & 7;
    if (!number) throw new Error('Ungültige Protobuf-Feldnummer.');
    let value;
    if (wire === 0) {
      [value, offset] = readVarint(bytes, offset);
    } else if (wire === 1) {
      if (offset + 8 > bytes.length) throw new Error('Unvollständiges Protobuf-Feld.');
      value = bytes.slice(offset, offset + 8);
      offset += 8;
    } else if (wire === 2) {
      let length;
      [length, offset] = readVarint(bytes, offset);
      if (offset + length > bytes.length) throw new Error('Unvollständiges Protobuf-Feld.');
      value = bytes.slice(offset, offset + length);
      offset += length;
    } else if (wire === 5) {
      if (offset + 4 > bytes.length) throw new Error('Unvollständiges Protobuf-Feld.');
      value = bytes.slice(offset, offset + 4);
      offset += 4;
    } else {
      throw new Error(`Nicht unterstützter Protobuf-Wire-Type ${wire}.`);
    }
    fields.push({ number, wire, value, original: bytes.slice(start, offset) });
  }
  return fields;
}

function encodeField(field) {
  const tag = writeVarint((field.number << 3) | field.wire);
  if (field.wire === 2) return concatBytes([tag, writeVarint(field.value.length), field.value]);
  if (field.wire === 0) return concatBytes([tag, writeVarint(field.value)]);
  return concatBytes([tag, field.value]);
}

function encodeMessage(fields) {
  return concatBytes(fields.map(encodeField));
}

function replaceUuidText(bytes, uuid) {
  let text = '';
  for (const byte of bytes) text += String.fromCharCode(byte);
  const replaced = text.replace(/[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}/gi, uuid);
  return Uint8Array.from(replaced, character => character.charCodeAt(0));
}

function escapeRtfPlainText(value) {
  let out = '';
  for (const char of String(value ?? '')) {
    const code = char.codePointAt(0);
    if (char === '\\' || char === '{' || char === '}') out += `\\${char}`;
    else if (char === '\n') out += '\\line ';
    else if (char === '\r') continue;
    else if (code >= 0x20 && code <= 0x7e) out += char;
    else if (code <= 0xffff) out += `\\u${code > 32767 ? code - 65536 : code}?`;
    else {
      const scalar = code - 0x10000;
      const high = 0xd800 + (scalar >> 10);
      const low = 0xdc00 + (scalar & 0x3ff);
      out += `\\u${high - 65536}?\\u${low - 65536}?`;
    }
  }
  return out;
}

function rtfText(value, superscriptVerseNumbers = false) {
  const text = String(value ?? '').replace(/\r\n?/g, '\n');
  if (!superscriptVerseNumbers) return escapeRtfPlainText(text);
  const marker = /(^|\s)(\d{1,3})\s*(?=[\p{L}„“"'(])/gu;
  let result = '';
  let cursor = 0;
  for (const match of text.matchAll(marker)) {
    const start = match.index;
    result += escapeRtfPlainText(text.slice(cursor, start));
    result += escapeRtfPlainText(match[1]);
    result += `\\super ${match[2]}\\nosupersub `;
    cursor = start + match[0].length;
  }
  result += escapeRtfPlainText(text.slice(cursor));
  return result;
}

function replaceRtfBody(rtfBytes, value, superscriptVerseNumbers = false) {
  const rtf = new TextDecoder('latin1').decode(rtfBytes);
  const bodyStart = rtf.indexOf('\\cf2 ');
  const bodyEnd = rtf.lastIndexOf('}');
  if (bodyStart < 0 || bodyEnd <= bodyStart) throw new Error('Textbereich in der PP7-Vorlage wurde nicht erkannt.');
  const prefix = rtf.slice(0, bodyStart + '\\cf2 '.length);
  const suffix = rtf.slice(bodyEnd);
  const replacement = prefix + rtfText(value, superscriptVerseNumbers) + suffix;
  return new TextEncoder().encode(replacement);
}

function transformMessage(bytes, replacements) {
  let fields;
  try {
    fields = parseMessage(bytes);
  } catch {
    return { bytes, changed: false };
  }
  let changed = false;
  const nextFields = fields.map(field => {
    if (field.wire !== 2) return field;
    if (field.value.length >= RTF_PREFIX.length && new TextDecoder().decode(field.value.slice(0, RTF_PREFIX.length)) === RTF_PREFIX) {
      const replacement = replacements.shift();
      if (!replacement) return field;
      changed = true;
      return { ...field, value: replaceRtfBody(field.value, replacement.text, replacement.superscriptVerseNumbers) };
    }
    const nested = transformMessage(field.value, replacements);
    if (nested.changed) {
      changed = true;
      return { ...field, value: nested.bytes };
    }
    return field;
  });
  return changed ? { bytes: encodeMessage(nextFields), changed: true } : { bytes, changed: false };
}

/**
 * Füllt eine einzelne native ProPresenter-Folie auf Basis der passenden
 * .pro-Vorlage. Die vorhandenen Layout- und Theme-Daten bleiben erhalten.
 */
export function createNativeSlide(templateBytes, slide) {
  if (!(templateBytes instanceof Uint8Array)) throw new Error('Die PP7-Vorlage konnte nicht geladen werden.');
  if (!slide || !['point', 'bible', 'quote', 'baptism'].includes(slide.type)) throw new Error('Unbekannter Folientyp.');

  // Das Stichpunkt-Theme ist in PP7 konsequent in Versalien gestaltet.
  // Den Inhalt deshalb beim Export unabhängig von der Eingabe-Schreibweise
  // vereinheitlichen; die Texte im Editor selbst bleiben unverändert.
  const replacements = slide.type === 'point'
    ? [{ text: String(slide.content ?? '').toLocaleUpperCase('de-DE') }]
    : [
        { text: slide.type === 'baptism' ? `${slide.name ?? ''}\n${slide.content ?? ''}` : (slide.content ?? ''), superscriptVerseNumbers: slide.type === 'bible' || slide.type === 'baptism' },
        { text: slide.type === 'quote' ? (slide.author ?? '') : (slide.reference ?? '') }
      ];

  const result = transformMessage(templateBytes, replacements);
  if (!result.changed || replacements.length) {
    throw new Error('Die Textfelder der PP7-Vorlage konnten nicht vollständig befüllt werden.');
  }
  return result.bytes;
}


const UUID_PATTERN = /[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}/gi;

function uuidRemapBytes(parts) {
  const combined = concatBytes(parts);
  let text = '';
  for (const byte of combined) text += String.fromCharCode(byte);
  const ids = new Map();
  const remapped = text.replace(UUID_PATTERN, id => {
    const key = id.toUpperCase();
    if (!ids.has(key)) ids.set(key, crypto.randomUUID().toUpperCase());
    return ids.get(key);
  });
  return Uint8Array.from(remapped, character => character.charCodeAt(0));
}

/**
 * Baut eine einzelne native ProPresenter-Präsentation aus mehreren
 * Einzelfolien-Vorlagen. Jede Folie behält ihre originale Layout-/Theme-Struktur.
 * Die UUIDs der Folienobjekte werden pro Folie konsistent erneuert, damit beim
 * mehrfachen Verwenden derselben Vorlage keine Objekt-IDs kollidieren.
 */
export function createNativePresentation(slides, templates) {
  if (!Array.isArray(slides) || slides.length === 0) {
    throw new Error('Es gibt keine Folien zum Exportieren.');
  }
  if (!templates?.bible || !templates?.point) {
    throw new Error('Die ProPresenter-Vorlagen sind nicht vollständig geladen.');
  }

  // ProPresenter speichert Gruppen in Feld 12 / Unterfeld 1 der Folien-Metadaten.
  // Die Struktur wird aus der mitgelieferten Punktvorlage übernommen, damit
  // keine unbekannten PP7-Felder geraten oder verworfen werden.
  const pointBaseFields = parseMessage(templates.point);
  const pointMeta = pointBaseFields.find(field => field.number === 12);
  const pointMetaFields = pointMeta ? parseMessage(pointMeta.value) : [];
  const pointGroupField = pointMetaFields.find(field => field.number === 1);
  const groupPrototype = pointGroupField ? parseMessage(pointGroupField.value) : [];
  if (!groupPrototype.some(field => field.number === 2) || !groupPrototype.some(field => field.number === 3)) {
    throw new Error('Die Gruppenstruktur der PP7-Vorlage konnte nicht gelesen werden.');
  }

  // Gruppenfarben: Schwarz wird grundsätzlich nicht verwendet.
  // Jede Punkt-Gruppe erhält unabhängig von ihrer Position dasselbe kräftige Rot.
  // Große, kontrastreiche Palette ohne Schwarz. Die Farben rotieren
  // über Bibelstellen- und Zitat-Gruppen, damit sich Farben seltener wiederholen.
  const palette = [
    [0.20, 0.48, 0.88, 1], // Blau
    [0.20, 0.68, 0.38, 1], // Grün
    [0.95, 0.52, 0.16, 1], // Orange
    [0.58, 0.34, 0.78, 1], // Violett
    [0.00, 0.62, 0.68, 1], // Türkis
    [0.82, 0.36, 0.58, 1], // Pink
    [0.62, 0.48, 0.20, 1], // Ocker
    [0.30, 0.62, 0.82, 1], // Himmelblau
    [0.48, 0.62, 0.22, 1], // Olivgrün
    [0.82, 0.42, 0.28, 1], // Koralle
    [0.42, 0.38, 0.72, 1], // Indigo
    [0.18, 0.62, 0.48, 1], // Jade
    [0.72, 0.30, 0.38, 1], // Weinrot
    [0.48, 0.52, 0.62, 1], // Schieferblau
    [0.72, 0.58, 0.18, 1], // Gold
    [0.36, 0.52, 0.32, 1]  // Waldgrün
  ];
  const pointGroupColor = [0.85, 0.12, 0.16, 1]; // Kräftiges Rot
  const groups = new Map();
  let lastGroupKey = null;
  let groupNumber = -1;
  const generated = slides.map((slide, index) => {
    const hasContent = Boolean(slide?.content?.trim());
    const hasBaptismName = slide?.type === 'baptism' && Boolean(slide?.name?.trim());
    // Tauffolien dürfen ohne Bibeltext exportiert werden: Das Namensfeld wird
    // befüllt, die Text- und Referenzfelder der Vorlage bleiben ansonsten leer.
    if (!hasContent && !hasBaptismName) throw new Error('Mindestens eine Folie enthält keinen Text. Bitte ergänze den Text vor dem Export.');
    const template = slide.type === 'point' ? templates.point : templates.bible;
    const bytes = createNativeSlide(template, slide);
    const fields = parseMessage(bytes);
    const slideFields = fields.filter(field => field.number === 12 || field.number === 13);
    const meta = slideFields.filter(field => field.number === 12);
    const objects = slideFields.filter(field => field.number === 13);
    if (meta.length !== 1 || objects.length !== 1) {
      throw new Error('Die Folienstruktur der verwendeten ProPresenter-Vorlage ist nicht eindeutig.');
    }
    const remapped = uuidRemapBytes([meta[0].original, objects[0].original]);
    const pair = parseMessage(remapped);
    const metaField = pair.find(field => field.number === 12);
    const objectField = pair.find(field => field.number === 13);

    // Ein Punkt ist immer eine eigene Gruppe. Aufeinanderfolgende Folien
    // derselben aufgeteilten Bibelstelle teilen dagegen eine Gruppe.
    const groupName = slide.type === 'point' ? 'Punkt' : slide.type === 'quote' ? 'Zitat' : slide.type === 'baptism' ? (slide.name || 'Taufe') : (slide.reference || 'Bibelstelle');
    const groupKey = slide.type === 'point' ? `point:${index}` : `${slide.type}:${groupName}`;
    if (groupKey !== lastGroupKey) groupNumber++;
    lastGroupKey = groupKey;
    if (!groups.has(groupKey)) groups.set(groupKey, {
      id: crypto.randomUUID().toUpperCase(),
      color: slide.type === 'point'
        ? pointGroupColor
        : palette[groupNumber % palette.length]
    });
    const group = groups.get(groupKey);

    const groupFields = groupPrototype.map(field => {
      if (field.number === 1 || field.number === 5) return { ...field, value: replaceUuidText(field.value, group.id) };
      if (field.number === 2) return { ...field, value: new TextEncoder().encode(groupName) };
      if (field.number === 3) {
        const colorFields = [
          { number: 1, wire: 5, value: new Uint8Array(new Float32Array([group.color[0]]).buffer) },
          { number: 2, wire: 5, value: new Uint8Array(new Float32Array([group.color[1]]).buffer) },
          { number: 3, wire: 5, value: new Uint8Array(new Float32Array([group.color[2]]).buffer) },
          { number: 4, wire: 5, value: new Uint8Array(new Float32Array([group.color[3]]).buffer) }
        ];
        return { ...field, value: encodeMessage(colorFields) };
      }
      return field;
    });
    const groupMetadataBytes = encodeMessage(groupFields);
    const nextMetaFields = parseMessage(metaField.value).map(field => field.number === 1
      ? { ...field, value: groupMetadataBytes }
      : field);
    const nextMeta = { ...metaField, value: encodeMessage(nextMetaFields) };
    return { meta: nextMeta, object: objectField };
  });

  // Die Punktvorlage enthält die globalen Präsentations-/Übergangsmetadaten.
  // Wir übernehmen diese einmalig und ersetzen nur die Folienobjekte.
  const baseFields = parseMessage(templates.point);
  const outputFields = [];
  let insertedSlides = false;
  for (const field of baseFields) {
    if (field.number === 12 || field.number === 13) {
      if (!insertedSlides) {
        outputFields.push(...generated.map(item => item.meta));
        outputFields.push(...generated.map(item => item.object));
        insertedSlides = true;
      }
      continue;
    }
    outputFields.push(field);
  }
  if (!insertedSlides) throw new Error('Die Basis-Präsentationsvorlage enthält keine Folienposition.');
  return encodeMessage(outputFields);
}
