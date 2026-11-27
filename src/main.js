import './style.css';
import { parseSermonEmail, removeNumericBracketMarkers } from './parser.js';
import { createNativePresentation } from './pro-export.js';
import bibleTemplateUrl from '../templates/Template_MUC-Bibelvers.pro?url';
import pointTemplateUrl from '../templates/Template_Stichpunkte.pro?url';

const app = document.querySelector('#app');
app.innerHTML = `
  <header class="topbar"><div class="topbar-inner"><div><h1>PP7 file creator</h1><p>Predigt-E-Mails vorbereiten und Folien bearbeiten</p></div><span class="session-note">Sitzungsdaten · werden nicht dauerhaft gespeichert</span></div></header>
  <main class="container">
    <section class="panel input-panel">
      <div class="section-heading"><div><span class="step">SCHRITT 1</span><h2>Predigt-E-Mail einfügen</h2></div></div>
      <textarea id="sermon-input" placeholder="Füge hier den Text deiner Predigt-E-Mail ein …"></textarea>
      <div class="actions"><button id="create-slides" class="primary">Präsentation erstellen</button><span class="hint">Bilder und Grafiken aus der E-Mail werden nicht verarbeitet.</span></div>
    </section>
    <section class="panel export-toolbar" id="export-toolbar" hidden><button class="primary export-all-slides">PP7-Datei herunterladen</button></section>
    <section class="panel editor-panel" id="editor" hidden>
      <div class="section-heading editor-heading"><div><span class="step">SCHRITT 2</span><h2>Folien bearbeiten</h2><p class="subheading">Alle Folien untereinander – Vorschau links, Bearbeitung rechts.</p></div><div class="editor-actions"><button id="add-slide" class="secondary add-slide-button">＋ Folie hinzufügen</button></div></div>
      <div class="slides-stack" id="slides-stack"></div>
      <div class="bottom-note"><strong>Gesamtexport:</strong> Alle Folien werden in ihrer aktuellen Reihenfolge in einer einzigen nativen ProPresenter-Datei gespeichert. Jede Folie erhält ihre PP7-Gruppe und Gruppenfarbe automatisch.</div>
      <div class="editor-actions editor-actions-bottom"><button class="secondary add-slide-button">＋ Folie hinzufügen</button></div>
    </section>
    <section class="panel export-bottom-toolbar" id="export-bottom-toolbar" hidden><button class="primary export-all-slides">PP7-Datei herunterladen</button></section>
    <div id="empty-state" class="empty-state"><span class="empty-icon">✦</span><strong>Noch keine Folien erstellt</strong><p>Füge oben deinen E-Mail-Text ein und klicke auf „Präsentation erstellen“.</p></div>
  </main>`;

let slides = [];
let pendingDeletion = null;
let undoTimer = null;
const $ = id => document.getElementById(id);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labelFor = slide => slide.type === 'bible' ? 'Bibelstelle' : slide.type === 'baptism' ? 'Taufe' : slide.type === 'quote' ? 'Zitat' : 'Punkt';

function previewMarkup(slide) {
  const sub = ['bible', 'baptism'].includes(slide.type) ? slide.reference : slide.type === 'quote' ? slide.author : '';
  const bibleBody = escapeHtml(slide.content || '').replace(/(^|\s)(\d{1,3})\s*(?=[\p{L}„“»"'(])/gu, (_, space, number) => `${space}<sup class="verse-number">${number}</sup>`);
  const body = slide.type === 'bible' ? bibleBody : slide.type === 'baptism' ? `${escapeHtml(slide.name || '')}<br>${bibleBody}` : escapeHtml(slide.content || '');
  const theme = slide.type === 'point' ? 'point-theme-preview' : slide.type === 'quote' ? 'quote-theme-preview' : 'bible-theme-preview';
  return `<div class="preview-screen ${theme}"><div class="preview-main">${body}</div><div class="preview-sub">${escapeHtml(sub || '')}</div></div>`;
}

function updateCardPreview(index) {
  const card = document.querySelector(`[data-slide-index="${index}"]`);
  if (!card) return;
  const slide = slides[index];
  card.querySelector('.preview-wrap').innerHTML = `${previewMarkup(slide)}<div class="preview-caption">VORSCHAU · 16:9</div>`;
  card.querySelector('.slide-heading').textContent = `${index + 1}. ${labelFor(slide)}`;
  card.querySelector('.slide-summary').textContent = ['bible', 'baptism'].includes(slide.type) ? (slide.type === 'baptism' ? slide.name : slide.reference) || 'Ohne Angabe' : slide.type === 'quote' ? slide.author || 'Zitat' : (slide.content || 'Ohne Text').slice(0, 90);
  card.querySelector('.reference-field').hidden = !['bible', 'baptism'].includes(slide.type);
  card.querySelector('.author-field').hidden = slide.type !== 'quote';
  card.querySelector('.name-field').hidden = slide.type !== 'baptism';
  card.querySelector('.content-label-text').textContent = slide.type === 'bible' || slide.type === 'baptism' ? 'Bibeltext' : slide.type === 'quote' ? 'Zitattext' : 'Text';
  card.querySelector('.type-input').value = slide.type;
}

function render() {
  const passageCounts = new Map();
  for (const slide of slides) {
    if (slide.passageGroupId) passageCounts.set(slide.passageGroupId, (passageCounts.get(slide.passageGroupId) || 0) + 1);
  }
  const passagePositions = new Map();
  const cards = slides.map((slide, index) => {
    let passageInfo = null;
    if (slide.passageGroupId) {
      const part = (passagePositions.get(slide.passageGroupId) || 0) + 1;
      passagePositions.set(slide.passageGroupId, part);
      passageInfo = { part, total: passageCounts.get(slide.passageGroupId) };
    }
    const groupClass = passageInfo ? ` bible-split-card bible-split-part-${(passageInfo.part - 1) % 3}` : '';
    const groupNote = passageInfo ? `<small class="passage-group-note">Zusammengehörige Bibelstelle · Teil ${passageInfo.part} von ${passageInfo.total}</small>` : '';
    return `
    <article class="slide-editor-card${groupClass}" data-slide-index="${index}" ${slide.passageGroupId ? `data-passage-group="${escapeHtml(slide.passageGroupId)}"` : ''}>
      <div class="slide-card-heading"><div><span class="slide-heading">${index + 1}. ${labelFor(slide)}</span><small class="slide-summary">${escapeHtml(['bible', 'baptism'].includes(slide.type) ? (slide.type === 'baptism' ? slide.name : slide.reference) || 'Ohne Angabe' : slide.type === 'quote' ? slide.author || 'Zitat' : (slide.content || 'Ohne Text').slice(0, 90))}</small>${groupNote}</div><div class="card-actions"><button class="secondary small move-up" ${index === 0 ? 'disabled' : ''} title="Nach oben">↑</button><button class="secondary small move-down" ${index === slides.length - 1 ? 'disabled' : ''} title="Nach unten">↓</button><button class="secondary small duplicate-slide">Duplizieren</button><button class="danger small delete-slide">Löschen</button></div></div>
      <div class="slide-editor-layout">
        <div class="preview-wrap">${previewMarkup(slide)}<div class="preview-caption">VORSCHAU · 16:9</div></div>
        <div class="fields">
          <label>Folientyp / Theme<select class="type-input"><option value="bible" ${slide.type === 'bible' ? 'selected' : ''}>Bibelstelle</option><option value="point" ${slide.type === 'point' ? 'selected' : ''}>Punkt</option><option value="quote" ${slide.type === 'quote' ? 'selected' : ''}>Zitat</option><option value="baptism" ${slide.type === 'baptism' ? 'selected' : ''}>Taufe</option></select></label>
          <div class="name-field" ${slide.type !== 'baptism' ? 'hidden' : ''}><label>Name des Täuflings<input class="name-input" type="text" value="${escapeHtml(slide.name || '')}" placeholder="z. B. Jan"></label></div>
          <div class="reference-field" ${!['bible', 'baptism'].includes(slide.type) ? 'hidden' : ''}><label>Bibelstelle inklusive Übersetzung<input class="reference-input" type="text" value="${escapeHtml(slide.reference || '')}" placeholder="z. B. Psalm 91,9-12 (LUT)"></label></div>
          <div class="author-field" ${slide.type !== 'quote' ? 'hidden' : ''}><label>Autor<input class="author-input" type="text" value="${escapeHtml(slide.author || '')}" placeholder="Name des Autors"></label></div>
          <label class="content-label"><span class="content-label-text">${slide.type === 'bible' || slide.type === 'baptism' ? 'Bibeltext' : slide.type === 'quote' ? 'Zitattext' : 'Text'}</span><textarea class="content-input">${escapeHtml(slide.content || '')}</textarea></label>
          <span class="hint edit-hint">Änderungen werden direkt übernommen.</span>
        </div>
      </div>
    </article>`;
  });

  if (pendingDeletion) {
    const undoCard = `<div class="undo-placeholder"><div><strong>Folie gelöscht</strong><span>Du kannst diese Folie innerhalb von 10 Sekunden wiederherstellen.</span></div><button class="undo-delete">Rückgängig</button></div>`;
    cards.splice(Math.min(pendingDeletion.index, cards.length), 0, undoCard);
  }
  $('slides-stack').innerHTML = cards.join('');
  $('empty-state').hidden = slides.length > 0 || Boolean(pendingDeletion);
  $('editor').hidden = slides.length === 0 && !pendingDeletion;
  $('export-toolbar').hidden = slides.length === 0;
  $('export-bottom-toolbar').hidden = slides.length === 0;

  $('slides-stack').querySelectorAll('.undo-delete').forEach(button => button.addEventListener('click', () => {
    if (!pendingDeletion) return;
    clearTimeout(undoTimer);
    slides.splice(Math.min(pendingDeletion.index, slides.length), 0, pendingDeletion.slide);
    pendingDeletion = null;
    render();
  }));

  $('slides-stack').querySelectorAll('.slide-editor-card').forEach(card => {
    const index = Number(card.dataset.slideIndex);
    const slide = slides[index];
    card.querySelector('.type-input').addEventListener('change', e => { slide.type = e.target.value; updateCardPreview(index); });
    card.querySelector('.reference-input').addEventListener('input', e => { slide.reference = e.target.value; updateCardPreview(index); });
    card.querySelector('.author-input').addEventListener('input', e => { slide.author = e.target.value; updateCardPreview(index); });
    card.querySelector('.name-input').addEventListener('input', e => { slide.name = e.target.value; updateCardPreview(index); });
    card.querySelector('.content-input').addEventListener('input', e => { slide.content = e.target.value; updateCardPreview(index); });
    card.querySelector('.duplicate-slide').addEventListener('click', () => { slides.splice(index + 1, 0, { ...slide, id: crypto.randomUUID() }); render(); });
    card.querySelector('.delete-slide').addEventListener('click', () => {
      if (undoTimer) clearTimeout(undoTimer);
      pendingDeletion = { slide, index };
      slides.splice(index, 1);
      render();
      undoTimer = setTimeout(() => { pendingDeletion = null; render(); }, 10000);
    });
    card.querySelector('.move-up').addEventListener('click', () => { if (index > 0) { [slides[index - 1], slides[index]] = [slides[index], slides[index - 1]]; render(); } });
    card.querySelector('.move-down').addEventListener('click', () => { if (index < slides.length - 1) { [slides[index + 1], slides[index]] = [slides[index], slides[index + 1]]; render(); } });
  });
}
async function exportAllSlides(button) {
  if (!slides.length) return;
  const originalLabel = button.textContent;
  const exportButtons = [...document.querySelectorAll('.export-all-slides')];
  exportButtons.forEach(item => { item.disabled = true; item.textContent = 'Erstelle Präsentation …'; });
  try {
    const [bibleResponse, pointResponse] = await Promise.all([fetch(bibleTemplateUrl), fetch(pointTemplateUrl)]);
    if (!bibleResponse.ok || !pointResponse.ok) throw new Error('Die ProPresenter-Vorlagen konnten nicht geladen werden.');
    const [bibleBytes, pointBytes] = await Promise.all([bibleResponse.arrayBuffer(), pointResponse.arrayBuffer()]);
    const outputBytes = createNativePresentation(slides, { bible: new Uint8Array(bibleBytes), point: new Uint8Array(pointBytes) });
    const blob = new Blob([outputBytes], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const now = new Date();
    const date = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('_');
    link.download = `${date}.pro`;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    document.querySelector('.bottom-note').innerHTML = `<strong>Erfolgreich erstellt:</strong> ${slides.length} Folien wurden als eine native PP7-Datei exportiert. Die Bearbeitung bleibt in dieser Sitzung erhalten.`;
  } catch (error) {
    document.querySelector('.bottom-note').textContent = error.message || 'Die PP7-Präsentation konnte nicht erstellt werden.';
  } finally {
    exportButtons.forEach(item => { item.disabled = false; item.textContent = originalLabel; });
  }
}

document.querySelectorAll('.export-all-slides').forEach(button => button.addEventListener('click', () => exportAllSlides(button))); 
document.querySelectorAll('.add-slide-button').forEach(button => button.addEventListener('click', () => {
  slides.push({ id: crypto.randomUUID(), type: 'point', content: '', warning: false });
  render();
  document.querySelector('.slide-editor-card:last-child')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}));

// Outlook und Apple Mail stellen beim Kopieren oft jede sichtbare Zeile
// als eigenen HTML-Absatz bereit. Solche Absätze werden zu einfachen
// Zeilenumbrüchen; wirklich leere Absätze bleiben Folientrenner.
$('sermon-input').addEventListener('paste', event => {
  const html = event.clipboardData?.getData('text/html');
  if (!html) return; // Bei reinem Text das normale Einfügen verwenden.

  event.preventDefault();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const output = [];
  const blockTags = new Set(['ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'DIV', 'LI', 'P', 'SECTION']);
  const appendBreak = value => {
    if (value && !value.endsWith('\n')) output.push('\n');
  };
  const walk = node => {
    if (node.nodeType === Node.TEXT_NODE) {
      output.push(node.nodeValue || '');
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = node.tagName;
    if (tag === 'BR') { output.push('\n'); return; }
    const isBlock = blockTags.has(tag);
    if (isBlock) appendBreak(output.join(''));
    const before = output.length;
    for (const child of node.childNodes) walk(child);
    const content = output.slice(before).join('').trim();
    if (isBlock) {
      if (!content) output.push('\n'); // leerer Absatz = bewusste Trennung
      else appendBreak(output.join(''));
    }
  };
  for (const child of doc.body.childNodes) walk(child);
  const pastedText = output.join('')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const textarea = event.currentTarget;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  textarea.setRangeText(pastedText, start, end, 'end');
});

$('create-slides').addEventListener('click', () => {
  const cleanedEmail = removeNumericBracketMarkers($('sermon-input').value);
  $('sermon-input').value = cleanedEmail;
  const parsed = parseSermonEmail(cleanedEmail);
  if (!parsed.length) { $('sermon-input').focus(); $('sermon-input').setCustomValidity('Bitte füge zuerst den Predigttext ein.'); $('sermon-input').reportValidity(); $('sermon-input').setCustomValidity(''); return; }
  slides = parsed; render(); $('editor').scrollIntoView({ behavior: 'smooth', block: 'start' });
});
$('empty-state').hidden = false;
