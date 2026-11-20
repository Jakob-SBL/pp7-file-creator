import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createNativeSlide, createNativePresentation } from '../src/pro-export.js';

const bibleTemplate = new Uint8Array(await readFile(new URL('../templates/Template_MUC-Bibelvers.pro', import.meta.url)));
const pointTemplate = new Uint8Array(await readFile(new URL('../templates/Template_Stichpunkte.pro', import.meta.url)));
const asLatin1 = bytes => new TextDecoder('latin1').decode(bytes);

function groupColorFromMeta(meta) {
  const group = rootFields(meta.value).find(field => field.number === 1);
  const color = rootFields(group.value).find(field => field.number === 3);
  const channels = rootFields(color.value).filter(field => field.wire === 5);
  return channels.map(field => new DataView(field.value.buffer, field.value.byteOffset, 4).getFloat32(0, true));
}
function rootFields(bytes) {
  const fields = [];
  let offset = 0;
  const readVarint = () => {
    let value = 0, shift = 0;
    while (offset < bytes.length) {
      const byte = bytes[offset++];
      value |= (byte & 0x7f) << shift;
      if (!(byte & 0x80)) return value >>> 0;
      shift += 7;
    }
    throw new Error('invalid varint');
  };
  while (offset < bytes.length) {
    const tag = readVarint();
    const number = tag >>> 3, wire = tag & 7;
    let value;
    if (wire === 0) value = readVarint();
    else if (wire === 2) { const length = readVarint(); value = bytes.slice(offset, offset + length); offset += length; }
    else if (wire === 1) { value = bytes.slice(offset, offset + 8); offset += 8; }
    else if (wire === 5) { value = bytes.slice(offset, offset + 4); offset += 4; }
    else throw new Error('unsupported wire');
    fields.push({ number, wire, value });
  }
  return fields;
}

test('erstellt eine native Stichpunktfolie und ersetzt den Vorlagentext', () => {
  const output = createNativeSlide(pointTemplate, { type: 'point', content: 'Ein neuer Testpunkt' });
  const text = asLatin1(output);
  assert.ok(text.includes('EIN NEUER TESTPUNKT'));
  assert.ok(!text.includes('DER TISCH IST GEDECKT'));
  assert.ok(output.length > 1000);
});

test('exportiert Punkttexte immer vollständig in Großbuchstaben', () => {
  const output = createNativeSlide(pointTemplate, {
    type: 'point',
    content: 'DIE BEWACHUNG DES GRAbes'
  });
  const text = asLatin1(output);
  assert.ok(text.includes('DIE BEWACHUNG DES GRABES'));
  assert.ok(!text.includes('DIE BEWACHUNG DES GRAbes'));
});

test('wandelt deutsche Umlaute und ß bei Punkttexten korrekt in Großbuchstaben um', () => {
  const output = createNativeSlide(pointTemplate, {
    type: 'point',
    content: 'für größere Häuser und Straßen'
  });
  const text = asLatin1(output);
  assert.ok(text.includes('F\\u220?R GR\\u214?SSERE H\\u196?USER UND STRASSEN'));
});

test('füllt Bibeltext und Bibelstellen-Referenz in getrennte Textfelder', () => {
  const output = createNativeSlide(bibleTemplate, {
    type: 'bible',
    content: '1 Am Anfang war das Wort. 2 Und das Wort war bei Gott.',
    reference: 'Johannes 1,1-2 (NGÜ)'
  });
  const text = asLatin1(output);
  assert.ok(text.includes('\\super 1\\nosupersub Am Anfang'));
  assert.ok(text.includes('\\super 2\\nosupersub Und das Wort'));
  assert.ok(text.includes('Johannes 1,1-2 (NG\\u220?'));
  assert.ok(!text.includes('Ihr k'));
  assert.ok(text.includes('1. Korinther 10, 21')); // nur noch in den unveränderten Dateimetadaten der Vorlage
});

test('verwendet beim Zitat den Autor im Referenzfeld der Bibelvorlage', () => {
  const output = createNativeSlide(bibleTemplate, { type: 'quote', content: 'Ein gutes Zitat', author: 'Max Muster' });
  const text = asLatin1(output);
  assert.ok(text.includes('Ein gutes Zitat'));
  assert.ok(text.includes('Max Muster'));
});


test('bündelt Bibel- und Punktfolien in einer nativen Präsentationsdatei', () => {
  const slides = [
    { type: 'point', content: 'Erster Stichpunkt' },
    { type: 'bible', content: '1Am Anfang war das Wort.', reference: 'Johannes 1,1 (NGÜ)' },
    { type: 'point', content: 'Zweiter Stichpunkt' }
  ];
  const output = createNativePresentation(slides, { bible: bibleTemplate, point: pointTemplate });
  const text = asLatin1(output);
  assert.equal((text.match(/ERSTER STICHPUNKT/g) || []).length, 1);
  assert.equal((text.match(/ZWEITER STICHPUNKT/g) || []).length, 1);
  assert.ok(text.includes('Johannes 1,1'));
  assert.equal((text.match(/DER TISCH IST GEDECKT/g) || []).length, 0);
  assert.ok(output.length > pointTemplate.length + bibleTemplate.length);
  const fields = rootFields(output);
  assert.equal(fields.filter(field => field.number === 12).length, 3);
  assert.equal(fields.filter(field => field.number === 13).length, 3);
});

test('erzeugt bei mehrfacher Verwendung derselben Vorlage unterschiedliche Objekt-IDs', () => {
  const slides = [
    { type: 'point', content: 'Punkt A' },
    { type: 'point', content: 'Punkt B' }
  ];
  const output = createNativePresentation(slides, { bible: bibleTemplate, point: pointTemplate });
  const text = asLatin1(output);
  assert.ok(text.includes('PUNKT A'));
  assert.ok(text.includes('PUNKT B'));
  const fields = rootFields(output);
  const metadata = fields.filter(field => field.number === 12);
  const objectData = fields.filter(field => field.number === 13);
  assert.equal(metadata.length, 2);
  assert.equal(objectData.length, 2);
  const uuidPattern = /[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}/gi;
  const idsBySlide = metadata.map((field, index) => {
    const combined = asLatin1(field.value) + asLatin1(objectData[index].value);
    return new Set(combined.match(uuidPattern) || []);
  });
  for (const id of idsBySlide[0]) assert.ok(!idsBySlide[1].has(id), `UUID ${id} darf nicht zwischen Folien geteilt werden`);
});

test('weist jeder Punktfolie eine eigene Gruppe zu und fasst geteilte Bibelstellen zusammen', () => {
  const slides = [
    { type: 'point', content: 'Punkt A' },
    { type: 'bible', content: '1Vers eins.', reference: 'Johannes 3,16-17' },
    { type: 'bible', content: '2Vers zwei.', reference: 'Johannes 3,16-17' },
    { type: 'point', content: 'Punkt B' }
  ];
  const output = createNativePresentation(slides, { bible: bibleTemplate, point: pointTemplate });
  const metadata = rootFields(output).filter(field => field.number === 12);
  const groupNames = metadata.map(meta => {
    const group = rootFields(meta.value).find(field => field.number === 1);
    const name = rootFields(group.value).find(field => field.number === 2);
    return new TextDecoder().decode(name.value);
  });
  assert.deepEqual(groupNames, ['Punkt', 'Johannes 3,16-17', 'Johannes 3,16-17', 'Punkt']);
});


test('verwendet kein Schwarz für Gruppen und färbt alle Punkt-Gruppen identisch rot', () => {
  const slides = [
    { type: 'point', content: 'Punkt A' },
    { type: 'bible', content: '1Vers eins.', reference: 'Johannes 3,16' },
    { type: 'quote', content: 'Ein Zitat', author: 'Max Muster' },
    { type: 'point', content: 'Punkt B' },
    { type: 'bible', content: '1Vers zwei.', reference: 'Römer 8,1' }
  ];
  const output = createNativePresentation(slides, { bible: bibleTemplate, point: pointTemplate });
  const metadata = rootFields(output).filter(field => field.number === 12);
  const colors = metadata.map(groupColorFromMeta);
  const red = [0.85, 0.12, 0.16, 1];
  for (const index of [0, 3]) {
    colors[index].forEach((channel, i) => assert.ok(Math.abs(channel - red[i]) < 1e-6));
  }
  for (const color of colors) {
    assert.ok(!(color[0] < 0.12 && color[1] < 0.12 && color[2] < 0.12), `Schwarze Gruppenfarbe gefunden: ${color}`);
  }
  assert.notDeepEqual(colors[1], red);
  assert.notDeepEqual(colors[2], red);
});

test('verwendet eine große abwechslungsreiche Farbpalette für Bibelstellen-Gruppen', () => {
  const slides = Array.from({ length: 12 }, (_, index) => ({
    type: 'bible',
    content: `Text ${index + 1}`,
    reference: `Johannes ${index + 1}`
  }));
  const output = createNativePresentation(slides, { bible: bibleTemplate, point: pointTemplate });
  const metadata = rootFields(output).filter(field => field.number === 12);
  const colors = metadata.map(groupColorFromMeta);
  const uniqueColors = new Set(colors.map(color => color.map(value => value.toFixed(4)).join(',')));
  assert.equal(uniqueColors.size, 12, 'die ersten zwölf Gruppen sollen zwölf verschiedene Farben erhalten');
  for (const color of colors) {
    assert.ok(!(color[0] < 0.12 && color[1] < 0.12 && color[2] < 0.12), `Schwarze Gruppenfarbe gefunden: ${color}`);
  }
});


test('exportiert eine Tauffolie mit Name oberhalb des Bibeltexts und Bibelstelle im Referenzfeld', () => {
  const output = createNativeSlide(bibleTemplate, {
    type: 'baptism', name: 'Claudia', content: 'Denn der Herr ist deine Zuversicht.', reference: 'Psalm 91,9-12 (LUT)'
  });
  const text = asLatin1(output);
  assert.ok(text.includes('Claudia\\line Denn der Herr ist deine Zuversicht.'));
  assert.ok(text.includes('Psalm 91,9-12 (LUT)'));
});

test('verwendet bei Tauffolien den Namen der Person als PP7-Gruppennamen', () => {
  const output = createNativePresentation([
    { type: 'baptism', name: 'Claudia', content: 'Ein Bibelvers.', reference: 'Psalm 91,9-12 (LUT)' }
  ], { bible: bibleTemplate, point: pointTemplate });
  const metadata = rootFields(output).find(field => field.number === 12);
  const group = rootFields(metadata.value).find(field => field.number === 1);
  const name = rootFields(group.value).find(field => field.number === 2);
  assert.equal(new TextDecoder().decode(name.value), 'Claudia');
});
