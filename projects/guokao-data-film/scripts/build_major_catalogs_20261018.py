#!/usr/bin/env python3
"""Parse newly obtained official major catalogs into traceable JSON.

Usage:
  python3 build_major_catalogs_20261018.py --workspace /path/to/source/files \
      --catalogs-root data/catalogs

Inputs (fixed bytes and SHA-256, no network access):
  grad_codebook_2023_admissions.docx  教育部高校学生司《研究生招生学科专业代码册》二〇二二年九月
  grad_codebook_2024_admissions.pdf   同书二〇二三年九月版（教学司〔2023〕11号 附件）
  selfset_secondary_2026.pdf          自主设置二级学科名单（截至2026年6月30日）附件1
  selfset_cross_2026.pdf              自主设置交叉学科名单 附件2

The code books are the only public documents that enumerate six-digit graduate
secondary-discipline codes. Two-digit gates and four-digit first-level
disciplines reuse the 2022 catalog namespace; this builder keeps a separate
namespace per edition because an edition is a distinct published document.

No applicant eligibility is produced. Names and codes are stored as printed.
"""
import argparse
import collections
import hashlib
import json
import re
import zipfile
from pathlib import Path

SOURCE_SPECS = {
    'grad_codebook_2023_admissions.docx': {
        'id': 'moe-graduate-codebook:2023-admissions',
        'sha256': '7e9dcc8a2186bcaa32e7d135259ee61939044fbfca3fc5690607558db8c16850',
        'url': 'https://www.wcjyj.com/data/upload/file/2311/15/65548688b8aae.docx',
        'title': '研究生招生学科、专业代码册',
        'authority': '教育部高校学生司',
        'edition': '2022-09',
        'admissions_year': 2023,
        'format': 'docx',
    },
    'grad_codebook_2024_admissions.pdf': {
        'id': 'moe-graduate-codebook:2024-admissions',
        'sha256': 'b653de028b6a288be3f7fda676619a1a04639e42fe834e2be50e6e506096940d',
        'url': 'https://rst.xinjiang.gov.cn/xjrst/c112746/202606/6200d15452494c00a1a50f6d7bb9edbf/files/2.%E9%99%84%E4%BB%B62%EF%BC%9A%E7%A0%94%E7%A9%B6%E7%94%9F%E6%8B%9B%E7%94%9F%E5%AD%A6%E7%A7%91%E4%B8%93%E4%B8%9A%E4%BB%A3%E7%A0%81%E5%86%8C%EF%BC%882023%E5%B9%B49%E6%9C%88%EF%BC%89.pdf',
        'title': '研究生招生学科专业代码册',
        'authority': '教育部高校学生司',
        'edition': '2023-09',
        'admissions_year': 2024,
        'format': 'pdf',
    },
    'selfset_secondary_2026.pdf': {
        'id': 'moe-selfset-2026-secondary',
        'sha256': 'a5350282f7e968f66f5a47bea9c79f0a049efe9f7c2a49c6d1e1eb1beeae75a8',
        'url': 'http://www.moe.gov.cn/jyb_xxgk/s5743/s5744/A22/202610/W020261009665543280642.pdf',
        'title': '学位授予单位（不含军队单位）自主设置二级学科名单（截至2026年6月30日）',
        'authority': '中华人民共和国教育部',
        'edition': '2026-06-30',
        'format': 'pdf',
    },
    'selfset_cross_2026.pdf': {
        'id': 'moe-selfset-2026-cross',
        'sha256': '98c0f760f98d3983435deaf2a99afa92cce998f32832d83cc6f24115daf8817c',
        'url': 'http://www.moe.gov.cn/jyb_xxgk/s5743/s5744/A22/202610/W020261009665543299282.pdf',
        'title': '学位授予单位（不含军队单位）自主设置交叉学科名单（截至2026年6月30日）',
        'authority': '中华人民共和国教育部',
        'edition': '2026-06-30',
        'format': 'pdf',
    },
}

# Printed code forms. A two-digit gate, a four-digit first-level discipline or
# professional degree category, or a six-character secondary code that may end
# in Z (self-set), J (self-filed cross discipline) or S (self-set degree type).
CODE_LINE = re.compile(r'^(\d{2}|\d{4}[A-Za-z0-9]{0,2}|\d{6}[A-Za-z0-9]?)$')
NAME_LINE = re.compile(r'^[^0-9\s].*$')


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def check(condition, message):
    if not condition:
        raise ValueError(message)


def dump(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')


def docx_lines(path):
    with zipfile.ZipFile(path) as archive:
        xml = archive.read('word/document.xml').decode('utf-8', 'replace')
    text = re.sub(r'<[^>]+>', '\n', xml)
    return [line.strip() for line in text.split('\n') if line.strip()]


def pdf_lines(path):
    from pypdf import PdfReader
    reader = PdfReader(path)
    lines = []
    for page in reader.pages:
        for line in (page.extract_text() or '').split('\n'):
            line = line.strip()
            if line:
                lines.append(line)
    return lines


def split_name(name_raw):
    """Separate trailing printed markers from the discipline name."""
    name = name_raw.strip()
    master_only = '★' in name
    doctor_only = '▲' in name
    name = name.replace('★', '').replace('▲', '').strip()
    parenthetical = None
    match = re.search(r'[（(]\s*(\d{4,6})\s*[)）]\s*$', name)
    if match:
        parenthetical = match.group(1)
        name = name[:match.start()].strip()
    return name, master_only, doctor_only, parenthetical


def parse_codebook(lines):
    """Read printed code/name pairs from either layout.

    The docx lays each code and the following name on separate lines; the PDF
    keeps "code name" on one line. Both are accepted, and a bare code followed
    by a name line still pairs, so a mixture cannot silently drop rows.
    """
    inline = re.compile(r'^(\d{2}|\d{4}[A-Za-z0-9]{0,2}|\d{6}[A-Za-z0-9]?)\s+(\S.*)$')
    nodes = []
    index = 0
    while index < len(lines):
        line = lines[index]
        code = None
        name_raw = None
        consumed = 1
        match = inline.fullmatch(line)
        if match and not CODE_LINE.fullmatch(match.group(2)):
            code, name_raw = match.group(1), match.group(2).strip()
        elif CODE_LINE.fullmatch(line) and index + 1 < len(lines):
            candidate = lines[index + 1]
            if NAME_LINE.match(candidate) and not CODE_LINE.fullmatch(candidate) and not inline.fullmatch(candidate):
                code, name_raw = line, candidate
                consumed = 2
        if not code:
            index += 1
            continue
        name, master_only, doctor_only, parenthetical = split_name(name_raw)
        if not name:
            index += 1
            continue
        nodes.append({
            'code': code.upper(),
            'name_raw': name_raw,
            'name': name,
            'master_only': master_only or None,
            'doctor_only': doctor_only or None,
            'old_code_in_name': parenthetical,
            'source_line': index + 1,
        })
        index += consumed
    return nodes


def level_of(code):
    if len(code) == 2:
        return 'discipline_group'
    if len(code) == 4:
        # Professional degree categories start at 5 in the third position.
        return 'professional_degree_category' if code[2] in '56789' else 'first_level_discipline'
    return 'secondary_discipline'


def build_codebook(spec, lines):
    nodes = parse_codebook(lines)
    # A printed year at the start of a wrapped sentence ("1997 年国务院…") is not
    # a discipline. Reject names that continue a sentence rather than name one.
    nodes = [node for node in nodes if not node['name'].startswith('年')]
    check(len(nodes) > 500, f'{spec["id"]}: implausible node count {len(nodes)}')

    printed_gates = {node['code']: node['name'] for node in nodes if len(node['code']) == 2}
    gate = None
    for node in nodes:
        node['level'] = level_of(node['code'])
        if node['level'] == 'discipline_group':
            gate = node
            node['id'] = f'{spec["id"]}:{node["code"]}'
            continue
        # The docx loses the merged cell holding gate codes 13 and 14. The gate
        # code is still the first two digits of every child code, so it is taken
        # from the code itself and marked when the printed row is absent.
        gate_code = node['code'][:2]
        node['gate_code'] = gate_code
        if node['level'] == 'secondary_discipline':
            node['parent_code'] = node['code'][:4]
            node['parent_id'] = f'{spec["id"]}:{node["parent_code"]}'
        else:
            node['parent_id'] = f'{spec["id"]}:{gate_code}'
        node['gate_name'] = printed_gates.get(gate_code)
        node['gate_row_printed'] = gate_code in printed_gates
        node['id'] = f'{spec["id"]}:{node["code"]}'
        node['namespace'] = spec['id']
        node['education_scope'] = 'graduate'
        node['admissions_year'] = spec['admissions_year']
    groups = collections.Counter(node['level'] for node in nodes)
    by_code = collections.defaultdict(list)
    for node in nodes:
        by_code[node['code']].append(node)
    duplicates = {code: len(items) for code, items in by_code.items() if len(items) > 1}
    unprinted_gates = sorted({node['gate_code'] for node in nodes
                              if node['level'] != 'discipline_group' and not node['gate_row_printed']})
    result = {
        'schema_version': '1.0.0',
        'catalog_id': spec['id'],
        'title': spec['title'],
        'authority': spec['authority'],
        'catalog_year': spec['admissions_year'],
        'edition': spec['edition'],
        'admissions_year': spec['admissions_year'],
        'education_scope': 'graduate',
        'source_url': spec['url'],
        'source_binary_sha256': spec['sha256'],
        'source_binary_checksum_verified': True,
        'extraction_method': 'pypdf / docx XML text extraction, then printed code+name pairing',
        'semantics': ('Printed enrollment code book. Six-digit secondary codes carry the 1997 catalog '
                      'code and name; they are not a claim that any position accepts them.'),
        'parsing_notes': [
            'This is an enrollment code book: four-digit codes are the codes招生单位 use and do not always equal the 2022 catalog numbering.',
            'Two-digit gates and four-digit first-level disciplines reuse the 2022 catalog namespace; this edition keeps its own namespace.',
            'A name marked ★ may only be used for master admission; ▲ only for doctoral admission.',
            'Codes ending in 00 are the unit-level enrollment form of a four-digit code, not a distinct major.',
            'Z marks an institution self-set secondary discipline, J a self-filed cross discipline, S a self-set degree type; they are not new national majors.',
        ],
        'printed_gates': printed_gates,
        'gates_missing_printed_row': unprinted_gates,
        'counts': dict(groups),
        'total_nodes': len(nodes),
        'duplicate_codes': len(duplicates),
        'nodes': nodes,
    }
    return result


def parse_selfset_secondary(path):
    import pdfplumber
    rows = []
    current = None
    with pdfplumber.open(path) as pdf:
        for page_number, page in enumerate(pdf.pages, 1):
            for table in page.extract_tables():
                for row in table:
                    if not row:
                        continue
                    cells = [(cell or '').replace('\n', '').strip() for cell in row]
                    if len(cells) < 3:
                        continue
                    if cells[0] and '单位名称' in cells[0]:
                        continue
                    if cells[0]:
                        current = cells[0]
                    if not cells[1] and not cells[2]:
                        continue
                    rows.append({
                        'institution': current,
                        'first_level_discipline_name': cells[1],
                        'selfset_discipline_name': cells[2],
                        'source_page': page_number,
                    })
    return rows


def parse_selfset_cross(path):
    import pdfplumber
    rows = []
    current = None
    with pdfplumber.open(path) as pdf:
        for page_number, page in enumerate(pdf.pages, 1):
            for table in page.extract_tables():
                for row in table:
                    if not row:
                        continue
                    cells = [(cell or '').replace('\n', '').strip() for cell in row]
                    if len(cells) < 3:
                        continue
                    if cells[0] and '单位名称' in cells[0]:
                        continue
                    if cells[0]:
                        current = cells[0]
                    if not cells[1]:
                        continue
                    involved = [name.strip() for name in re.split(r'[、,，]', cells[2]) if name.strip()]
                    rows.append({
                        'institution': current,
                        'selfset_discipline_name': cells[1],
                        'involved_first_level_disciplines_raw': cells[2],
                        'involved_first_level_disciplines': involved,
                        'source_page': page_number,
                    })
    return rows


def build_selfset(spec, rows, kind):
    institutions = sorted({row['institution'] for row in rows if row['institution']})
    names = sorted({row['selfset_discipline_name'] for row in rows})
    check(not any(row['institution'] is None for row in rows), f'{spec["id"]}: unassigned institution')
    return {
        'schema_version': '1.0.0',
        'catalog_id': spec['id'],
        'title': spec['title'],
        'authority': spec['authority'],
        'edition': spec['edition'],
        'kind': kind,
        'source_url': spec['url'],
        'source_binary_sha256': spec['sha256'],
        'source_binary_checksum_verified': True,
        'extraction_method': 'pdfplumber table extraction with vertically merged institution cells',
        'semantics': ('Institution self-set discipline names filed with the Ministry of Education. The list '
                      'publishes names only; it does not publish the six-digit Z or J codes that institutions '
                      'assign locally, so no code is inferred here.'),
        'counts': {
            'entries': len(rows),
            'institutions': len(institutions),
            'distinct_selfset_names': len(names),
        },
        'institutions': institutions,
        'rows': rows,
    }


def compare_editions(older, newer):
    old_codes = {node['code'] for node in older['nodes']}
    new_codes = {node['code'] for node in newer['nodes']}
    old_by_code = {node['code']: node['name'] for node in older['nodes']}
    new_by_code = {node['code']: node['name'] for node in newer['nodes']}
    return {
        'older_catalog_id': older['catalog_id'],
        'newer_catalog_id': newer['catalog_id'],
        'older_nodes': older['total_nodes'],
        'newer_nodes': newer['total_nodes'],
        'codes_only_in_older': sorted(old_codes - new_codes),
        'codes_only_in_newer': sorted(new_codes - old_codes),
        'same_code_different_name': sorted(code for code in old_codes & new_codes if old_by_code[code] != new_by_code[code]),
        'shared_codes': len(old_codes & new_codes),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--workspace', type=Path, required=True)
    parser.add_argument('--catalogs-root', type=Path, default=Path(__file__).resolve().parents[1] / 'data' / 'catalogs')
    args = parser.parse_args()

    for filename, spec in SOURCE_SPECS.items():
        path = args.workspace / filename
        check(path.exists(), f'missing pinned input {filename}')
        digest = sha256(path)
        check(digest == spec['sha256'], f'{filename}: SHA-256 mismatch {digest}')

    book_2023 = build_codebook(SOURCE_SPECS['grad_codebook_2023_admissions.docx'],
                               docx_lines(args.workspace / 'grad_codebook_2023_admissions.docx'))
    book_2024 = build_codebook(SOURCE_SPECS['grad_codebook_2024_admissions.pdf'],
                               pdf_lines(args.workspace / 'grad_codebook_2024_admissions.pdf'))
    secondary = build_selfset(SOURCE_SPECS['selfset_secondary_2026.pdf'],
                              parse_selfset_secondary(args.workspace / 'selfset_secondary_2026.pdf'), 'selfset_secondary')
    cross = build_selfset(SOURCE_SPECS['selfset_cross_2026.pdf'],
                          parse_selfset_cross(args.workspace / 'selfset_cross_2026.pdf'), 'selfset_cross')

    # Independent totals published with the 2026 roster.
    check(secondary['counts']['entries'] == 5536, 'secondary self-set entries must equal the published 5536')
    check(cross['counts']['entries'] == 1214, 'cross self-set entries must equal the published 1214')
    union = set(secondary['institutions']) | set(cross['institutions'])
    # Press coverage of this roster reported 496 institutions. The two official
    # PDFs parse to 497 distinct institution strings with no punctuation-only
    # duplicates, so the difference is recorded rather than forced to match.
    check(len(union) in (496, 497), f'unexpected institution union size {len(union)}')
    institution_union_note = {
        'parsed_union': len(union),
        'secondary_only_institutions': len(set(secondary['institutions']) - set(cross['institutions'])),
        'cross_only_institutions': len(set(cross['institutions']) - set(secondary['institutions'])),
        'press_reported_institutions': 496,
        'discrepancy': len(union) - 496,
        'reason': ('Secondary press coverage reported 496. The official attachments enumerate '
                   '497 distinct institution strings; no near-duplicate names were found, so the '
                   'difference is left standing instead of being merged.'),
    }

    for book in (book_2023, book_2024):
        counts = book['counts']
        printed_or_derived = {node['gate_code'] for node in book['nodes'] if node['level'] != 'discipline_group'}
        check(len(printed_or_derived) == 14, f'{book["catalog_id"]}: expected 14 discipline gates, found {len(printed_or_derived)}')
        check(counts.get('secondary_discipline', 0) >= 550, f'{book["catalog_id"]}: implausible secondary-discipline count')
        check(book['duplicate_codes'] == 0, f'{book["catalog_id"]}: duplicate printed codes')

    comparison = compare_editions(book_2023, book_2024)
    for book in (book_2023, book_2024):
        book['edition_comparison'] = comparison

    outputs = {
        'major_graduate_codebook_2023_admissions_official_parsed.json': book_2023,
        'major_graduate_codebook_2024_admissions_official_parsed.json': book_2024,
        'major_selfset_2026_official_parsed.json': {
            'schema_version': '1.0.0',
            'catalog_id': 'moe-selfset:2026',
            'authority': '中华人民共和国教育部',
            'edition': '2026-06-30',
            'semantics': 'Self-set discipline roster, names only, no locally assigned codes.',
            'secondary': secondary,
            'cross': cross,
            'union_institutions': sorted(union),
            'institution_union_note': institution_union_note,
            'counts': {
                'secondary_entries': secondary['counts']['entries'],
                'cross_entries': cross['counts']['entries'],
                'institutions_union': len(union),
            },
        },
    }
    written = {}
    for filename, payload in outputs.items():
        path = args.catalogs_root / filename
        dump(path, payload)
        written[filename] = {
            'bytes': path.stat().st_size,
            'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
        }

    summary = {
        'codebook_2023': {'counts': book_2023['counts'], 'total': book_2023['total_nodes']},
        'codebook_2024': {'counts': book_2024['counts'], 'total': book_2024['total_nodes']},
        'edition_comparison': comparison,
        'selfset': outputs['major_selfset_2026_official_parsed.json']['counts'],
        'written': written,
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
