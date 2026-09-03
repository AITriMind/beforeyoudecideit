"""
Subsets the self-hosted faces to the characters the site actually sets.

The cuts came from Google's `latin` and `cyrillic` slices: 230 and 105
codepoints. This walks the tree, collects every character the site can render —
the markup, the dictionary in both languages, the case content, the generated
pages — and cuts each face to that set plus a margin of the alphabets it belongs
to, so an owner can edit copy without regenerating fonts.

`unicode-range` in the stylesheet is narrowed to match. That matters: a
codepoint inside the declared range but missing from the file renders as tofu,
whereas one outside the range falls back to the next family in the stack.

    python scripts/subset-fonts.py [--check]

Originals stay in assets/fonts/src/. Needs fonttools and brotli.
"""
import os
import re
import sys
import glob
import shutil

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
FONTS = os.path.join(ROOT, 'assets', 'fonts')
SRC = os.path.join(FONTS, 'src')

# Everything that can put a character on screen.
SOURCES = [
    'index.html',
    'assets/domain/strings.js',
    'content/cases.js',
    'assets/domain/crystal.js',
    'assets/domain/decision-map.js',
    'scripts/build-pages.mjs',
    'scripts/render-crystal.mjs',
]
SOURCES += [os.path.relpath(p, ROOT) for p in glob.glob(os.path.join(ROOT, 'decisions', '**', '*.html'), recursive=True)]
SOURCES += [os.path.relpath(p, ROOT) for p in glob.glob(os.path.join(ROOT, 'research', '*.html'))]

LATIN_MARGIN = set(range(0x20, 0x7F))
CYRILLIC_MARGIN = set(range(0x410, 0x450)) | {0x401, 0x451}
# punctuation and marks the design uses, kept in both slices
SHARED = {0x00A0, 0x00AB, 0x00BB, 0x00B7, 0x2010, 0x2013, 0x2014, 0x2018,
          0x2019, 0x201C, 0x201D, 0x201E, 0x2026, 0x2212}


def collect():
    """Every codepoint the tree can render."""
    seen = set()
    for rel in SOURCES:
        path = os.path.join(ROOT, rel)
        if not os.path.exists(path):
            continue
        text = open(path, encoding='utf-8').read()
        # strip markup so tag names do not widen the set — they are ASCII anyway
        text = re.sub(r'<[^>]+>', ' ', text)
        seen.update(ord(ch) for ch in text)
    return {cp for cp in seen if cp >= 0x20}


def ranges(codepoints):
    """Contiguous runs, as CSS unicode-range tokens."""
    out = []
    for cp in sorted(codepoints):
        if out and cp == out[-1][1] + 1:
            out[-1][1] = cp
        else:
            out.append([cp, cp])
    return ', '.join(
        f'U+{a:04X}' if a == b else f'U+{a:04X}-{b:04X}'
        for a, b in out
    )


def subset_face(src_path, out_path, keep):
    font = TTFont(src_path)
    available = set(font.getBestCmap())
    wanted = sorted(available & keep)
    options = subset.Options()
    options.flavor = 'woff2'
    options.layout_features = ['*']
    options.name_IDs = ['*']
    options.notdef_outline = True
    options.drop_tables = []
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(unicodes=wanted)
    subsetter.subset(font)
    font.flavor = 'woff2'
    font.save(out_path)
    return wanted


def main():
    check = '--check' in sys.argv
    if not os.path.isdir(SRC):
        os.makedirs(SRC, exist_ok=True)
        for p in glob.glob(os.path.join(FONTS, '*.woff2')):
            shutil.copy2(p, os.path.join(SRC, os.path.basename(p)))
        print(f'kept the originals in {os.path.relpath(SRC, ROOT)}')

    used = collect()
    latin_keep = (used & set(range(0x0000, 0x0250))) | LATIN_MARGIN | SHARED
    cyrillic_keep = (used & set(range(0x0400, 0x0530))) | CYRILLIC_MARGIN | SHARED | {0x2116}

    report = []
    for src_path in sorted(glob.glob(os.path.join(SRC, '*.woff2'))):
        name = os.path.basename(src_path)
        keep = cyrillic_keep if 'cyrillic' in name else latin_keep
        out_path = os.path.join(FONTS, name)
        before = os.path.getsize(src_path)
        if check:
            if not os.path.exists(out_path):
                print(f'{name} has not been subset'); return 1
            continue
        kept = subset_face(src_path, out_path, keep)
        after = os.path.getsize(out_path)
        report.append((name, before, after, len(kept), ranges(kept)))

    if check:
        print('subset fonts are present')
        return 0

    total_before = sum(r[1] for r in report)
    total_after = sum(r[2] for r in report)
    for name, before, after, count, _ in report:
        print(f'{name:32} {before // 1024:>3}KB -> {after // 1024:>3}KB  {count:>3} codepoints')
    print(f'{"total":32} {total_before // 1024:>3}KB -> {total_after // 1024:>3}KB')
    print()
    print('unicode-range for the latin cuts:')
    print(' ', next(r[4] for r in report if 'cyrillic' not in r[0]))
    print('unicode-range for the cyrillic cuts:')
    print(' ', next(r[4] for r in report if 'cyrillic' in r[0]))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
