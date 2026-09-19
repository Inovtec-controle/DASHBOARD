from pathlib import Path


def replace_exact(path, old, new, expected):
    file = Path(path)
    content = file.read_text(encoding='utf-8')
    count = content.count(old)
    if count != expected:
        raise SystemExit(f'{path}: expected {expected} occurrences, found {count}: {old}')
    file.write_text(content.replace(old, new), encoding='utf-8')
    print(f'OK : {path} — {count} référence(s) actualisée(s)')


replace_exact(
    'PLANNINGS-LEGACY.html',
    'planning-travel-pause.js?v=20260917-planning-live3',
    'planning-travel-pause.js?v=20260919-highlight-v2',
    1,
)
replace_exact(
    'PLANNINGS.html',
    'PLANNINGS-LEGACY.html%3Fv%3D20260917-planning-preservation1',
    'PLANNINGS-LEGACY.html%3Fv%3D20260919-highlight-v2',
    2,
)
