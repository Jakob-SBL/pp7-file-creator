import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSermonEmail } from '../src/parser.js';

test('teilt 1. Korinther 10:1-4 bei mindestens vier Versen unabhängig von Versgrenzen', () => {
  const email = `2.        1. Korinther 10:1-4 (NGÜ)\nIhr dürft nämlich nicht vergessen, Geschwister, wie es unseren Vorfahren ´zur Zeit des Mose\u0060 erging. Über ihnen allen war die Wolkensäule, und alle durchquerten sie das Meer, 2sodass sie alle gewissermaßen eine Taufe auf Mose erlebten – eine Taufe durch die Wolke und durch das Meer. 3Sie aßen alle dieselbe Nahrung – das Brot vom Himmel, das Gott ihnen gab –, 4und tranken alle denselben Trank – einen Trank, den Gott ihnen gab, das Wasser aus dem Felsen (wobei der wahre Fels, der sie begleitete und von dessen Wasser sie tranken, Christus war`;
  const slides = parseSermonEmail(email);
  assert.equal(slides.length, 2, 'the available text area should be used more fully');
  assert.ok(slides.every(s => s.reference === '1. Korinther 10:1-4 (NGÜ)'));
  const combined = slides.map(s => s.content).join(' ');
  assert.match(combined, /^1 Ihr/);
  for (const verse of [1, 2, 3, 4]) assert.match(combined, new RegExp(`(?:^|\\s)${verse}\\s`));
  assert.match(combined, /Christus war$/);
  assert.ok(slides.every(s => s.content.length <= 360));
  assert.ok(slides.some(s => !/^\\d{1,3}\\s/.test(s.content)), 'a slide may start within a verse');
});

test('teilt nicht, wenn Versnummern nicht sicher erkannt werden', () => {
  const slides = parseSermonEmail('Johannes 3:16-17 (NGÜ)\nDenn Gott hat die Welt so sehr geliebt. Der Sohn kam zu uns.');
  assert.equal(slides.length, 1);
});


test('ergänzt die erste Versnummer nicht doppelt, wenn sie bereits im Text steht', () => {
  const email = `1. Korinther 10:1-4 (NGÜ)\n1Ihr dürft nicht vergessen. 2So erging es den Vorfahren. 3Sie aßen. 4Und sie tranken.`;
  const slides = parseSermonEmail(email);
  assert.equal(slides.length, 1);
  assert.match(slides[0].content, /^1 Ihr/);
  assert.doesNotMatch(slides[0].content, /^11/);
});

test('teilt 1. Samuel 16,11-13 auch bei geschützten Leerzeichen nach Versnummern', () => {
  const email = `Dann fragte er: »Sind das alle deine Söhne?« Isai antwortete: »Der jüngste fehlt noch. Er hütet gerade die Schafe und Ziegen.« »Lass ihn holen!«, forderte Samuel ihn auf. »Wir setzen uns nicht ´zum Opfermahl\`, bevor er bei uns ist.«\u200212 Da ließ Isai ihn holen. David sah gut aus, er war gebräunt[6] und hatte schöne Augen. »Er ist es«, sagte der HERR zu Samuel, »salbe ihn zum König!«\u200213 Samuel nahm das Horn mit dem Öl und salbte ihn vor den Augen seiner Brüder zum König. Von diesem Tag an kam der Geist des HERRN über David und verließ ihn nicht mehr. Samuel aber kehrte nach Rama zurück.\n1. Samuel 16,11-13`;
  const slides = parseSermonEmail(email);
  assert.equal(slides.length, 2, 'the passage should use the available space more fully');
  assert.ok(slides.every(s => s.type === 'bible'));
  assert.ok(slides.every(s => s.reference === '1. Samuel 16,11-13'));
  assert.ok(slides.every(s => s.passageGroupId === slides[0].passageGroupId), 'all split slides share a visual passage group');
  assert.match(slides[0].content, /^11/);
  assert.ok(slides.some(s => /12\s*Da ließ Isai/.test(s.content)));
  assert.ok(slides.some(s => /13\s*Samuel nahm/.test(s.content)));
  assert.match(slides.at(-1).content, /Rama zurück\.$/);
  assert.ok(slides.every(s => s.content.length <= 360), 'each slide stays below the conservative text budget');
});

test('erkennt eine nachgestellte, eingeklammerte Kurzreferenz als Bibelstelle', () => {
  const email = 'Nicht ihr habt mich erwählt, sondern ich habe euch erwählt: Ich habe euch dazu bestimmt, zu gehen und Frucht zu tragen – Frucht, die Bestand hat.« (Joh 15,16)';
  const slides = parseSermonEmail(email);
  assert.equal(slides.length, 1);
  assert.equal(slides[0].type, 'bible');
  assert.equal(slides[0].reference, 'Johannes 15,16');
  assert.match(slides[0].content, /^Nicht ihr habt mich erwählt/);
  assert.doesNotMatch(slides[0].content, /Joh 15,16/);
});


test('verknüpft eine alleinstehende Referenz im Folgeabsatz mit dem Bibeltext', () => {
  const slides = parseSermonEmail(`Nicht ihr habt mich erwählt, sondern ich habe euch erwählt.\n\n(Joh 15,16)`);
  assert.equal(slides.length, 1);
  assert.equal(slides[0].type, 'bible');
  assert.equal(slides[0].reference, 'Johannes 15,16');
  assert.match(slides[0].content, /^Nicht ihr habt mich erwählt/);
});


test('entfernt numerische eckige Quellenmarker, erhält aber Auslassungsklammern', () => {
  const slides = parseSermonEmail('David war gebräunt[6] und hatte schöne Augen [4]. Das bleibt [...] offen.');
  assert.equal(slides.length, 1);
  assert.match(slides[0].content, /gebräunt und hatte/);
  assert.match(slides[0].content, /Das bleibt \[\.\.\.\] offen/);
  assert.doesNotMatch(slides[0].content, /\[\d+\]/);
});

test('erkennt einen in Anführungszeichen stehenden Predigttitel und den folgenden nummerierten Stichpunkt als zwei Punktfolien', () => {
  const slides = parseSermonEmail('"Was David uns über Berufung beibringen würde"\n\n1.     GOTT ÜBERSIEHT DICH NICHT');
  assert.equal(slides.length, 2);
  assert.deepEqual(slides.map(slide => slide.type), ['point', 'point']);
  assert.equal(slides[0].content, '"Was David uns über Berufung beibringen würde"');
  assert.equal(slides[1].content, 'GOTT ÜBERSIEHT DICH NICHT');
});

test('erkennt Titel und nummerierten Punkt auch ohne Leerabsatz als zwei Punktfolien', () => {
  const slides = parseSermonEmail('„Was David uns über Berufung beibringen würde“\n\u00a01.     GOTT ÜBERSIEHT DICH NICHT');
  assert.equal(slides.length, 2);
  assert.deepEqual(slides.map(slide => slide.type), ['point', 'point']);
  assert.equal(slides[1].content, 'GOTT ÜBERSIEHT DICH NICHT');
});

test('trennt Titel und nummerierten Punkt auch bei gleichem E-Mail-Absatz', () => {
  const slides = parseSermonEmail('"Was David uns über Berufung beibringen würde"\n1.     GOTT ÜBERSIEHT DICH NICHT');
  assert.equal(slides.length, 2);
  assert.deepEqual(slides.map(slide => slide.type), ['point', 'point']);
});

test('erkennt unzitierten Predigttitel vor nummeriertem Stichpunkt als zwei Punktfolien statt als Zitat', () => {
  const slides = parseSermonEmail('Was David uns über Berufung beibringen würde\n\n1.     GOTT ÜBERSIEHT DICH NICHT');
  assert.equal(slides.length, 2);
  assert.deepEqual(slides.map(slide => slide.type), ['point', 'point']);
  assert.equal(slides[0].content, 'Was David uns über Berufung beibringen würde');
  assert.equal(slides[1].content, 'GOTT ÜBERSIEHT DICH NICHT');
});

test('erkennt nummerierten Punkt auch bei maskiertem Punktzeichen', () => {
  const slides = parseSermonEmail('Was David uns über Berufung beibringen würde\n\n1\\.     GOTT ÜBERSIEHT DICH NICHT');
  assert.equal(slides.length, 2);
  assert.deepEqual(slides.map(slide => slide.type), ['point', 'point']);
  assert.equal(slides[1].content, 'GOTT ÜBERSIEHT DICH NICHT');
});

test('teilt Galater 5,16–26 NGÜ trotz ungeklämmerter Übersetzungsangabe vollständig auf', () => {
  const email = `Galater 5,16–26 NGÜ
16 Was will ich damit sagen? Lasst den Geist ´Gottes\u0060 euer Verhalten bestimmen, dann werdet ihr nicht mehr den Begierden eurer eigenen Natur nachgeben. 17 Denn die menschliche Natur richtet sich mit ihrem Begehren gegen den Geist ´Gottes\u0060, und der Geist ´Gottes\u0060 richtet sich mit seinem Begehren gegen die menschliche Natur. Die beiden liegen im Streit miteinander, und jede Seite will verhindern, dass ihr das tut, wozu die andere Seite euch drängt.  18 Wenn ihr euch jedoch vom Geist ´Gottes\u0060 führen lasst, steht ihr nicht mehr unter ´der Herrschaft\u0060 des Gesetzes. 19 Im Übrigen ist klar ersichtlich, was die Auswirkungen sind, wenn man sich von der eigenen Natur beherrschen lässt: sexuelle Unmoral, Schamlosigkeit, Ausschweifung, 20 Götzendienst, okkulte Praktiken, Feindseligkeiten, Streit, Eifersucht, Wutausbrüche, Rechthaberei, Zerwürfnisse, Spaltungen, 21 Neid, Trunkenheit, Fressgier und noch vieles andere, was genauso ´verwerflich\u0060 ist. Ich kann euch diesbezüglich nur warnen, wie ich es schon früher getan habe: Wer so ´lebt und\u0060 handelt, wird keinen Anteil am Reich Gottes bekommen, dem Erbe, das Gott für uns bereithält.
22 Die Frucht hingegen, die der Geist Gottes hervorbringt,besteht in Liebe, Freude, Frieden, Geduld, Freundlichkeit, Güte, Treue, 23 Rücksichtnahme und Selbstbeherrschung. Gegen solches ´Verhalten\u0060 hat kein Gesetz etwas einzuwenden. 24 Nun, wer zu Jesus Christus[gehört, hat seine eigene Natur mit ihren Leidenschaften und Begierden gekreuzigt. 25 Da wir also durch ´Gottes\u0060 Geist ein ´neues\u0060 Leben haben, wollen wir uns jetzt auch auf Schritt und Tritt von diesem Geist bestimmen lassen.`;
  const slides = parseSermonEmail(email);
  assert.ok(slides.length > 1, 'the long passage should be split across multiple slides');
  assert.ok(slides.every(slide => slide.type === 'bible'));
  assert.ok(slides.every(slide => slide.reference === 'Galater 5,16–26 NGÜ'));
  assert.ok(slides.every(slide => slide.passageGroupId === slides[0].passageGroupId));
  const combined = slides.map(slide => slide.content).join(' ');
  assert.match(combined, /^16 Was will ich damit sagen\?/);
  assert.match(combined, /25 Da wir also/);
  assert.match(combined, /bestimmen lassen\.$/);
  assert.ok(slides.every(slide => slide.content.length <= 360));
});



test('entfernt Zeilenumbrüche zwischen einzeln eingegebenen Bibelversen', () => {
  const email = `Apostelgeschichte 1,4-9 NGÜ
4 Einmal – es war bei einer gemeinsamen Mahlzeit – wies er sie an, Jerusalem vorläufig nicht zu verlassen, sondern die Erfüllung der Zusage abzuwarten, die der Vater ihnen gegeben hatte. »Ich habe darüber ja bereits mit euch gesprochen«, sagte er.
5 »Johannes hat mit Wasser getauft, ihr aber werdet mit dem Heiligen Geist getauft werden, und das schon in wenigen Tagen.«
8 Aber wenn der Heilige Geist auf euch herabkommt, werdet ihr mit seiner Kraft ausgerüstet werden, und das wird euch dazu befähigen, meine Zeugen zu sein – in Jerusalem, in ganz Judäa und Samarien und ´überall sonst auf der Welt, selbst\u0060 in den entferntesten Gegenden der Erde.« 
9 Nachdem Jesus das gesagt hatte, wurde er vor ihren Augen emporgehoben. Dann hüllte ihn eine Wolke ein, und sie sahen ihn nicht mehr.`;
  const slides = parseSermonEmail(email);
  assert.ok(slides.length > 1, 'the long passage should be split across multiple slides');
  assert.ok(slides.every(slide => slide.type === 'bible'));
  assert.ok(slides.every(slide => !slide.content.includes('\n')), 'Bible slide text should not contain line breaks');
  const combined = slides.map(slide => slide.content).join(' ');
  assert.match(combined, /^4 Einmal/);
  assert.match(combined, /5 »Johannes hat mit Wasser getauft/);
  assert.match(combined, /8 Aber wenn der Heilige Geist/);
  assert.match(combined, /9 Nachdem Jesus das gesagt hatte/);
  assert.match(combined, /und sie sahen ihn nicht mehr\.$/);
});

test('erkennt ein Zitat nur mit ausdrücklicher Personenangabe', () => {
  const slides = parseSermonEmail('Martin Luther\n\nHier steht ein beispielhaftes Zitat.');
  assert.equal(slides.length, 1);
  assert.equal(slides[0].type, 'quote');
  assert.equal(slides[0].author, 'Martin Luther');
});

test('erkennt Namen mit Initialen und Namenspartikeln als Zitat-Autoren', () => {
  const initials = parseSermonEmail('C. S. Lewis\n\nEin beispielhaftes Zitat.');
  const particles = parseSermonEmail('Corrie ten Boom\n\nEin beispielhaftes Zitat.');
  assert.equal(initials[0].type, 'quote');
  assert.equal(initials[0].author, 'C. S. Lewis');
  assert.equal(particles[0].type, 'quote');
  assert.equal(particles[0].author, 'Corrie ten Boom');
});

test('erkennt die ausdrückliche Formulierung „Zitat von“ auch bei einem einzelnen Namen', () => {
  const slides = parseSermonEmail('Zitat von Jesus\n\nEin beispielhaftes Zitat.');
  assert.equal(slides[0].type, 'quote');
  assert.equal(slides[0].author, 'Jesus');
});

test('behandelt einen Text ohne erkennbaren Personennamen nicht als Zitat', () => {
  const slides = parseSermonEmail('Was David uns über Berufung beibringen würde\n\nGOTT ÜBERSIEHT DICH NICHT');
  assert.deepEqual(slides.map(slide => slide.type), ['point', 'point']);
});

test('behandelt allgemeine Überschriften und einzelne Wörter nicht als Zitat-Autor', () => {
  const heading = parseSermonEmail('Gott ist treu\n\nEr bleibt an unserer Seite.');
  const oneWord = parseSermonEmail('Hoffnung\n\nEs gibt immer einen Weg.');
  assert.equal(heading[0].type, 'point');
  assert.equal(oneWord[0].type, 'point');
});


test('erkennt die Personenangabe auch hinter dem Zitat in derselben Zeile', () => {
  const slides = parseSermonEmail('„Ein beispielhaftes Zitat.“ – C. S. Lewis');
  assert.equal(slides.length, 1);
  assert.equal(slides[0].type, 'quote');
  assert.equal(slides[0].author, 'C. S. Lewis');
  assert.equal(slides[0].content, '„Ein beispielhaftes Zitat.“');
});


test('schreibt häufige deutsche Bibelbuch-Abkürzungen im Editor aus', () => {
  const cases = [
    ['Joh. 3,16 (NGÜ)\\nVersinhalt', 'Johannes 3,16 (NGÜ)'],
    ['Mt. 5,1-3\\nVersinhalt', 'Matthäus 5,1-3'],
    ['Mk. 1,2\\nVersinhalt', 'Markus 1,2'],
    ['Lk. 2,4\\nVersinhalt', 'Lukas 2,4'],
    ['1. Kor. 13,1-2\\nVersinhalt', '1. Korinther 13,1-2'],
    ['2. Tim. 4,7\\nVersinhalt', '2. Timotheus 4,7'],
    ['Gal. 5,16-17\\n16 Vers eins. 17 Vers zwei.', 'Galater 5,16-17']
  ];
  for (const [email, expected] of cases) {
    const slides = parseSermonEmail(email);
    assert.ok(slides.length > 0, email);
    assert.equal(slides[0].reference, expected, email);
  }
});

test('erkennt Pluszeichen zwischen Versnummern in einer Bibelreferenz', () => {
  const slides = parseSermonEmail('4. Mose 27, 3+4 (NGÜ)\nDer Text der Bibelstelle.');
  assert.equal(slides.length, 1);
  assert.equal(slides[0].type, 'bible');
  assert.equal(slides[0].reference, '4. Mose 27, 3+4 (NGÜ)');
  assert.equal(slides[0].content, '3 Der Text der Bibelstelle.');
});

test('teilt den langen Text zu 4. Mose 27, 3+4 zuverlässig auf mehrere Folien', () => {
  const text = '"Unser Vater ist in der Wüste gestorben. Er gehörte aber nicht zu den Anhängern Korachs, die sich offen gegen den HERRN gestellt haben. Vielmehr ist er gestorben, weil er Gott nicht gehorcht hat ´– wie alle anderen aus seiner Generation`. Nun hat unser Vater aber keine Söhne hinterlassen. Soll unsere Familie jetzt den Anspruch auf Grundbesitz verlieren, der uns von unserem Vater her zugestanden hätte, nur weil kein männlicher Erbe da ist? Gebt uns Grundbesitz, damit das Erbe unseres Vaters genauso behandelt wird wie das seiner Brüder."';
  const slides = parseSermonEmail(`4. Mose 27, 3+4 (NGÜ)\n${text}`);
  assert.ok(slides.length > 1, 'the long passage must be split across multiple slides');
  assert.ok(slides.every(slide => slide.type === 'bible'));
  assert.ok(slides.every(slide => slide.reference === '4. Mose 27, 3+4 (NGÜ)'));
  assert.ok(slides.every(slide => slide.passageGroupId === slides[0].passageGroupId));
  assert.ok(slides.every(slide => slide.content.length <= 360), 'each chunk stays within the single-verse chunk budget');
  const combined = slides.map(slide => slide.content).join(' ').replace(/\s+/g, ' ').trim();
  assert.ok(combined.includes('Unser Vater ist in der Wüste gestorben.'));
  assert.ok(combined.includes('Gebt uns Grundbesitz, damit das Erbe unseres Vaters genauso behandelt wird wie das seiner Brüder.'));
  assert.equal(combined.replace(/\s/g, ''), `3 ${text}`.replace(/\s/g, ''));
});

test('erkennt Buchstaben-Zusätze a und b an Versnummern', () => {
  for (const suffix of ['a', 'b']) {
    const slides = parseSermonEmail(`Galater 3, 29${suffix} (LUT)\nDer Text der Bibelstelle.`);
    assert.equal(slides.length, 1);
    assert.equal(slides[0].type, 'bible');
    assert.equal(slides[0].reference, `Galater 3, 29${suffix} (LUT)`);
    assert.equal(slides[0].content, 'Der Text der Bibelstelle.');
  }
});

test('erkennt Bibelstellen auch ohne Versangabe nach dem Kapitel', () => {
  const johannes = parseSermonEmail('Johannes 17\nJesus betete für seine Jünger.');
  const apostelgeschichte = parseSermonEmail('Apostelgeschichte 3\nPetrus und Johannes gingen zum Tempel.');
  assert.equal(johannes.length, 1);
  assert.equal(johannes[0].type, 'bible');
  assert.equal(johannes[0].reference, 'Johannes 17');
  assert.equal(johannes[0].content, 'Jesus betete für seine Jünger.');
  assert.equal(apostelgeschichte.length, 1);
  assert.equal(apostelgeschichte[0].type, 'bible');
  assert.equal(apostelgeschichte[0].reference, 'Apostelgeschichte 3');
  assert.equal(apostelgeschichte[0].content, 'Petrus und Johannes gingen zum Tempel.');
});

test('teilt Lukas 18,18-30 auch bei Versnummern direkt nach schließenden Anführungszeichen', () => {
  const email = `Lukas 18,18-30
18 Ein führender Mann des jüdischen Volkes stellte Jesus einmal folgende Frage: »Guter Meister, was muss ich tun, um das ewige Leben zu bekommen?« 19 »Warum nennst du mich gut?«, fragte Jesus ihn. »Nur Gott ist wirklich gut. 20 Doch du kennst die Gebote: ›Du sollst nicht die Ehe brechen. Du sollst nicht töten. Du sollst nicht stehlen. Du sollst keine Falschaussage machen. Ehre deinen Vater und deine Mutter.« 21 Der Mann erwiderte: »Seit meiner Kindheit habe ich diese Gebote alle befolgt.« 22 »Es gibt noch eines, das dir fehlt«, sagte daraufhin Jesus. »Verkaufe alles, was du hast, und gib das Geld den Armen, und du wirst einen Schatz im Himmel haben. Dann komm und folge mir nach.« 23 Als der Mann das hörte, wurde er traurig, denn er war sehr reich. 24 Jesus sah ihm nach, als er wegging, und sagte dann zu seinen Jüngern: »Wie schwer ist es doch für die Reichen, ins Reich Gottes zu kommen! 25 Eher geht ein Kamel durch ein Nadelöhr, als dass ein Reicher ins Reich Gottes kommt!« 26 Als die Umstehenden das hörten, sagten sie: »Wer kann denn dann überhaupt gerettet werden?« 27 Er antwortete: »Was menschlich gesehen unmöglich ist, ist bei Gott möglich.« 28 Da sagte Petrus: »Wir haben unser Zuhause verlassen und sind dir nachgefolgt.« 29 »Ja«, erwiderte Jesus, »und ich versichere euch: Wer Haus oder Frau oder Geschwister oder Eltern oder Kinder für das Reich Gottes aufgegeben hat, 30 wird es in diesem Leben vielfältig zurückbekommen und in der zukünftigen Welt das ewige Leben erhalten.«`;
  const slides = parseSermonEmail(email);
  assert.ok(slides.length > 1, 'the long passage must be split');
  assert.ok(slides.every(slide => slide.type === 'bible'));
  assert.ok(slides.every(slide => slide.reference === 'Lukas 18,18-30'));
  const combined = slides.map(slide => slide.content).join(' ');
  for (const verse of [18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30]) {
    assert.match(combined, new RegExp(`(?:^|\\s)${verse}\\s`), `verse ${verse} must be preserved`);
  }
  assert.ok(slides.every(slide => slide.passageGroupId === slides[0].passageGroupId));
});

test('leitet Versgrenzen auch aus einem Kapitelverweis ohne Versbereich ab', () => {
  const slides = parseSermonEmail('Lukas 18\n18 Er fragte Jesus und erklärte ausführlich, was die Menschen verstehen sollten. '.repeat(5) + '19 Jesus antwortete und erläuterte den nächsten Schritt mit vielen weiteren Worten. '.repeat(5) + '20 Danach gingen sie gemeinsam weiter und sprachen noch lange über das Geschehen. '.repeat(5));
  assert.ok(slides.length > 1);
  assert.ok(slides.every(slide => slide.reference === 'Lukas 18'));
  assert.match(slides[0].content, /^18 Er fragte/);
});


test('teilt auch einen einzelnen sehr langen Bibelvers ohne Textverlust an Wortgrenzen', () => {
  const body = 'Dieser sehr lange Vers enthält viele wichtige Gedanken und soll auf keinen Fall abgeschnitten werden. '.repeat(8);
  const slides = parseSermonEmail(`Johannes 3,16\n16 ${body.trim()}`);
  assert.ok(slides.length > 1, 'one oversized verse must be split across slides');
  assert.ok(slides.every(slide => slide.content.length <= 360));
  const combined = slides.map(slide => slide.content.replace(/^16\s*/, '')).join(' ');
  assert.equal(combined.replace(/\s+/g, ' ').trim(), body.trim().replace(/\s+/g, ' '));
});

test('teilt Bibelabschnitte ab vier Versen unabhängig von Versgrenzen', () => {
  const verse1 = '16 Dieser erste Vers enthält einen langen Gedanken mit vielen Wörtern und endet hier bewusst erst nach einer ausführlichen Erklärung.';
  const verse2 = '17 Dieser zweite Vers setzt den Gedanken fort und enthält ebenfalls viele Wörter, damit die Folientrennung mitten im Vers möglich wird.';
  const verse3 = '18 Dieser dritte Vers beschreibt weitere wichtige Einzelheiten und führt den Text ohne Unterbrechung ausführlich weiter.';
  const verse4 = '19 Dieser vierte Vers schließt den Abschnitt mit einer letzten ausführlichen Aussage und bleibt vollständig erhalten.';
  const slides = parseSermonEmail(`Galater 5,16-19\n${verse1} ${verse2} ${verse3} ${verse4}`);
  assert.ok(slides.length > 1);
  assert.ok(slides.every(slide => slide.content.length <= 360));
  const combined = slides.map(slide => slide.content).join(' ');
  assert.equal(combined.replace(/\s+/g, ' ').trim(), [verse1, verse2, verse3, verse4].join(' '));
  assert.ok(slides.some(slide => !/^\\d{1,3}\\s/.test(slide.content)), 'at least one slide should be allowed to begin inside a verse');
  for (const verse of [16, 17, 18, 19]) assert.match(combined, new RegExp(`(?:^|\\s)${verse}\\s`));
});


test('erkennt nummerierte Bibelbücher auch ohne Leerzeichen nach dem Punkt', () => {
  for (const [input, expected] of [
    ['1.Petrus 5,6', '1. Petrus 5,6'],
    ['4.Mose 27,3-4', '4. Mose 27,3-4'],
    ['2.Korinther 5,17', '2. Korinther 5,17']
  ]) {
    const slides = parseSermonEmail(`${input}\nEin Beispieltext.`);
    assert.equal(slides[0].type, 'bible');
    assert.equal(slides[0].reference, expected);
  }
});

test('erkennt einen Taufblock mit Name und Vers als eigene Tauffolie', () => {
  const slides = parseSermonEmail(`Name: Claudia\n\nVers: Psalm 91,9-12 (LUT)\n\n“Denn der Herr ist deine Zuversicht, der Höchste ist deine Zuflucht. Es wird dir kein Übel begegnen.“`);
  assert.equal(slides.length, 1);
  assert.equal(slides[0].type, 'baptism');
  assert.equal(slides[0].name, 'Claudia');
  assert.equal(slides[0].reference, 'Psalm 91,9-12 (LUT)');
  assert.equal(slides[0].content, 'Denn der Herr ist deine Zuversicht, der Höchste ist deine Zuflucht. Es wird dir kein Übel begegnen.');
  assert.doesNotMatch(slides[0].content, /Name:|Vers:/);
});

test('erkennt mehrere Tauf-Einträge auch ohne Leerzeilen und entfernt alle Name-/Vers-Labels', () => {
  const email = `Name: Katharina Vers: 1. Johannes 4,16 (LUT) „Gott ist die Liebe; und wer in der Liebe bleibt, der bleibt in Gott und Gott in ihm.“ Name: Marina Vers: Psalm 23, 1+6 (LUT) “Der Herr ist mein Hirte; mir wird nichts mangeln.” “Gutes und Barmherzigkeit werden mir folgen mein Leben lang und ich werde bleiben im Hause des Herrn immerdar.“ Name: Christian Vers: (tbd) Name: Tamara Vers: (tbd) Name: Celina Vers: Johannes 8,12 (NGÜ) “Ich bin das Licht der Welt.”`;
  const slides = parseSermonEmail(email);
  assert.deepEqual(slides.map(slide => slide.name), ['Katharina', 'Marina', 'Christian', 'Tamara', 'Celina']);
  assert.ok(slides.every(slide => slide.type === 'baptism'));
  assert.equal(slides[0].reference, '1. Johannes 4,16 (LUT)');
  assert.match(slides[0].content, /Gott ist die Liebe/);
  assert.equal(slides[1].reference, 'Psalm 23, 1+6 (LUT)');
  assert.equal(slides[2].reference, '');
  assert.equal(slides[3].reference, '');
  assert.equal(slides[4].reference, 'Johannes 8,12 (NGÜ)');
  assert.ok(slides.every(slide => !/Name:|Vers:/.test(`${slide.name} ${slide.reference} ${slide.content}`)));
});
