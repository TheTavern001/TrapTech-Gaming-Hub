# Build public/i18n/<lang>.json from tools/i18n/strings.tsv (column 1 = English source string, "@key" rows are named keys).
import csv, json, os
rows = list(csv.reader(open(os.path.join(os.path.dirname(__file__), 'strings.tsv')), delimiter='\t'))
h = rows[0]; out = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'i18n'); os.makedirs(out, exist_ok=True)
for i, lang in enumerate(h[1:], 1):
    d = {r[0]: r[i] for r in rows[1:] if r[i] and r[i] != r[0]}
    json.dump(d, open(os.path.join(out, lang + '.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(h) - 1, 'languages,', len(rows) - 1, 'strings')
