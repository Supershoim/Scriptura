from pathlib import Path

target = Path('work/app-template.html')
text = target.read_text(encoding='utf8')
start = text.index('function highlight(')
end = text.index('let referenceAnchor=', start)
text = text[:start] + Path('work/highlight.js').read_text(encoding='utf8') + '\n' + text[end:]
start = text.index('let referenceAnchor=')
end = text.index('function rowsHtml(', start)
text = text[:start] + Path('work/reference-ui.js').read_text(encoding='utf8') + '\n' + Path('work/cell.js').read_text(encoding='utf8') + '\n' + text[end:]
start = text.index('.references{margin-top:10px;')
end = text.index('.translationhead{flex-wrap:wrap}', start)
text = text[:start] + '.inline-references{display:inline;margin:0 .22em;color:var(--muted);font:11px/1.7 "Segoe UI",Arial,sans-serif;vertical-align:baseline;user-select:none;-webkit-user-select:none;white-space:normal;overflow-wrap:anywhere}.inline-references .ref-link{font:inherit;border:0;border-radius:3px;padding:0 1px;background:transparent;color:var(--green);text-decoration:underline;text-decoration-style:dotted;text-underline-offset:2px;white-space:normal;text-align:left;user-select:none;-webkit-user-select:none}.ref-empty{font:11px/1.7 "Segoe UI",sans-serif;color:var(--muted)}' + text[end:]
start = text.index('<h3>Trimiteri și copiere</h3>')
end = text.index('<h3>Sursele și prelucrarea</h3>', start)
text = text[:start] + '<h3>Trimiteri și copiere</h3><p>Trimiterile apar direct în text, între paranteze drepte, lângă cuvintele marcate în PDF cu *, **, † și celelalte semne. Abrevierile și ordinea trimiterilor sunt păstrate. Treci cu mouse-ul peste o trimitere pentru a-i citi textul în VDCC. Previzualizarea funcționează și prin focalizare cu tasta Tab sau atingere pe telefon; Escape o închide. „Cap.” indică un capitol din cartea versetului, iar „Vers.” un verset din capitolul curent. Trimiterile fără marcaj în corpul PDF sunt așezate la finalul versetului. PDF-ul NTR furnizat nu conține trimiteri tipărite.</p><p>Copierea unui verset sau a capitolului în clipboard include exclusiv textul biblic, fără trimiteri sau marcaje. „Copiază capitolul” copiază tot capitolul, inclusiv când este selectat un singur verset. Alege VDCC, NTR sau ambele din selector, ori folosește butonul din antetul fiecărei traduceri. Textul copiat include cartea, capitolul, traducerea și numerele versetelor.</p>\n' + text[end:]
text = text.replace('Trimiterile sunt afișate separat de textul versetului, cu formularea tipărită;', 'Trimiterile sunt intercalate la marcajele din text, cu formularea tipărită;')
assert 'referenceSection' not in text
assert 'class="references"' not in text
target.write_text(text, encoding='utf8')
print('Inline references integrated')
