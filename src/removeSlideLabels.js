/**
 * Entfernt automatisch eingefügte Folienüberschriften aus E-Mail-Texten.
 *
 * Beispiele:
 *   Folie 1:
 *   Folie 13:
 *   Folie 125:
 *
 * Auch wenn nach dem Doppelpunkt weiterer Text in derselben Zeile steht,
 * wird nur die Bezeichnung entfernt.
 */
export function removeSlideLabels(text) {
  return String(text ?? '')
    .split(/\r?\n/)
    .map(line => line.replace(/^\s*Folie\s+\d+\s*:\s*/i, ''))
    .filter(line => line.trim().length > 0)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
