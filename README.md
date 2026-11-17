# PP7 file creator

Lokale Browser-App auf Basis von Vite. Predigttext wird nur im Arbeitsspeicher der geöffneten Browser-Sitzung verarbeitet. Es wird kein Predigttext in Local Storage, Cookies oder einer Datenbank gespeichert. Beim Schließen der Seite geht der aktuelle Arbeitsstand verloren. Theme- und Vorlagendateien bleiben im Projektordner erhalten.

## Start auf dem Mac

1. Projektordner in VS Code öffnen.
2. Im VS-Code-Terminal `npm install` ausführen (bei einer frischen Installation).
3. `npm run dev` starten.
4. Die angezeigte lokale Adresse im Browser öffnen.

Tests ausführen: `npm test`.

## Funktionen

- Predigt-E-Mail einfügen und in Folienvorschläge aufteilen.
- Bibelstellen, Zitate mit Autor und Stichpunkte erkennen; Referenzen am Textende in Klammern (z. B. `(Joh 15,16)`) werden ebenfalls als Bibelstellen erkannt.
- Lange Bibelstellen mit konservativerer Textgrenze an Versgrenzen auf mehrere Folien verteilen, auch wenn Versnummern durch geschützte Leerzeichen vom Text getrennt sind; Referenz und Übersetzung auf jeder Folie wiederholen.
- Alle Folien werden untereinander angezeigt: Vorschau links, Bearbeitungsfelder rechts. Text bearbeiten, Folientyp wechseln, Folien hinzufügen, duplizieren, löschen und verschieben.
- Alle Folien in ihrer aktuellen Reihenfolge als **eine native ProPresenter-7-Datei (`.pro`)** herunterladen.
- Jede Stichpunktfolie erhält eine eigene PP7-Gruppe namens `Punkt`; geteilte Folien derselben Bibelstelle bleiben in einer gemeinsamen Gruppe. Gruppenfarben wechseln automatisch zwischen Grau, Blau, Grün, Orange und Violett.
- Der Download verändert oder leert den Editor nicht.
- Es gibt keinen separaten Einzelfolien-Testdownload mehr.

## Vorschau und Vorlagen

- `templates/Template_MUC-Bibelvers.pro`: native Bibelstellen-Masterfolie für Bibeltext und Zitat.
- `templates/Template_Stichpunkte.pro`: native Masterfolie für Stichpunkte und Überschriften.
- `themes/Theme_MUC-Bibelvers.protheme`: Theme für Bibelstellen und Zitate.
- `themes/Theme_Stichpunkte.protheme`: Theme für Stichpunkte und Überschriften.

Die Bibelstellen- und Zitatvorschau orientiert sich an der originalen ProPresenter-Masterfolie: Haupttext oben links, Referenz bzw. Autor in einem separaten Feld weiter unten rechts. Schriftgrößen skalieren proportional zur Vorschaufläche. Das Punkt-Theme bleibt in seiner bisherigen Darstellung unverändert.

## Noch offen

- Die Browser-Vorschau ist eine maßstabsgetreue Annäherung an die PP7-Folie. Die Bibeltext-Aufteilung nutzt eine bewusst konservative Zeichengrenze; ein einzelner außergewöhnlich langer Vers kann weiterhin eine manuelle Kontrolle erfordern. Ein abschließender visueller Abgleich mit weiteren ProPresenter-Bildschirmgrößen und längeren Texten bleibt sinnvoll.
- Das Hinzufügen und Verwalten weiterer Themes direkt in der App ist noch offen.
- Die automatische Texterkennung und Aufteilung kann bei ungewöhnlichen E-Mail-Formaten manuelle Korrekturen erfordern.

## Projektdateien

- `src/parser.js`: Texterkennung und Folienaufteilung.
- `src/main.js`: App, Vorschau und Editor.
- `src/pro-export.js`: Erzeugung der nativen ProPresenter-Datei.
- `src/style.css`: App-Oberfläche und Theme-orientierte Vorschau.
- `themes/`: vorhandene `.protheme`-Dateien.
- `templates/`: zugehörige native `.pro`-Vorlagen.
