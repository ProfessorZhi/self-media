#!/usr/bin/env python3
"""Build per-position major evidence across the 专业 and 备注 columns.

Usage:
  python3 build_major_evidence.py --project /path/to/guokao-data-film \
      --output data/major_evidence_2027

Inputs are the committed position shards, the committed requirement shards and
the parsed catalogs. No network access, no eligibility output.

What this adds over data/majors_2027 (kept unchanged as the "before" layer):
  1. 备注 code extraction with context filtering, so telephone numbers, years
     and area codes are not counted as majors.
  2. The two official graduate enrollment code books, which are the only
     public documents that enumerate six-digit graduate secondary codes.
  3. Two-digit discipline-gate prefixes ("02法学") that the earlier token
     regex (four to seven digits) could not see.
  4. The 2026 self-set discipline roster, used to mark a name as an officially
     filed self-set discipline rather than a national catalog major.

Education namespaces are never merged. A code that exists for both bachelor and
graduate is reported as ambiguous unless the clause pins the level. Codes ending
in 00 are recorded as the enrollment form of their four-digit parent, never as a
distinct major. Z/J/S codes keep their institution-local status.
"""
import argparse
import collections
import hashlib
import json
import re
from pathlib import Path

TOKEN = re.compile(r'(?<![A-Za-z0-9])([0-9]{4,7}[A-Za-z0-9]*)(?![A-Za-z0-9])')
GATE_PREFIX = re.compile(r'(?<![0-9A-Za-z])([0-9]{2})(?=[一-鿿])')
DEGREE_WORD = re.compile(r'大学本科|博士研究生|硕士研究生|研究生|本科|硕士|博士|大专|专科')
NEGATIVE = re.compile(r'不含|不包括|不包含|除|不得|不接受|不招')
QUALIFIER = re.compile(r'方向|仅限|限于|限.{0,6}专业|相关|相近|同时|均[为须需]|须为|应为|需为|等专业|等相关|语种')
UNRESTRICTED = re.compile(r'^(专业)?(不限|无限制|不限专业|不限制专业|专业不限)[。；;\s]*$')
CUE = re.compile(r'专业|学科|门类|代码|所学|毕业|本科|研究生|硕士|博士|学位')
YEAR_LIKE = re.compile(r'^(19|20)\d{2}$')
# Ministry of Education, 关于教育部2027年度公务员考录职位要求的说明, 2026-10-14:
# "职位专业要求为学科门类的，即该门类所包含的专业和一级学科均符合要求；
#  专业要求为一级学科的，即该一级学科所包含的二级学科均符合要求。"
MOE_2027_RULE = {
    'title': '关于教育部2027年度公务员考录职位要求的说明',
    'authority': '教育部人事司',
    'date': '2026-10-14',
    'url': 'http://www.moe.gov.cn/s78/A04/tongzhi/202610/t20261014_1454189.html',
    'applies_to': '教育部 2027 年度考录职位；其门类/一级学科包含语义为国内通行口径',
    'text': '职位专业要求为学科门类的，即该门类所包含的专业和一级学科均符合要求；专业要求为一级学科的，即该一级学科所包含的二级学科均符合要求。',
}
AREA_CODES = {
    '010', '020', '021', '022', '023', '024', '025', '027', '028', '029',
    '0311', '0351', '0371', '0411', '0431', '0451', '0511', '0531', '0551',
    '0571', '0591', '0711', '0731', '0751', '0771', '0791', '0811', '0851',
    '0871', '0891', '0898',
}


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def dump(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')


def education_scopes(education):
    scopes = []
    if '本科' in education:
        scopes.append('bachelor')
    if '研究生' in education or education in ('本科及以上', '大专及以上'):
        scopes.append('graduate')
    if '大专' in education or '专科' in education:
        scopes.append('associate')
    if education == '大专及以上' and 'bachelor' not in scopes:
        scopes.append('bachelor')
    return scopes or ['unknown']


class CatalogIndex:
    """Code and exact-name index that keeps education namespaces separate."""

    def __init__(self):
        self.by_code = collections.defaultdict(list)
        self.by_name = collections.defaultdict(list)
        self.names = set()

    def add(self, namespace, scope, code, name, level, node_id):
        node = {'namespace': namespace, 'education_scope': scope, 'code': code,
                'name': name, 'level': level, 'id': node_id}
        self.by_code[(scope, code.upper())].append(node)
        self.by_name[(scope, name)].append(node)
        self.names.add(name)

    def resolve_code(self, code, scopes):
        code = code.upper()
        hits = []
        for scope in scopes:
            if scope == 'unknown':
                for candidate_scope in ('bachelor', 'graduate'):
                    hits.extend(self.by_code.get((candidate_scope, code), []))
            else:
                hits.extend(self.by_code.get((scope, code), []))
        namespaces = {hit['namespace'] for hit in hits}
        if not hits:
            return {'status': 'unresolved', 'nodes': []}
        # The same code and the same printed name in two editions of one catalog
        # family is one identity, not an ambiguity.
        if len({hit['name'] for hit in hits}) == 1:
            return {'status': 'resolved', 'nodes': hits}
        if len(namespaces) > 1 and len(scopes) > 1:
            return {'status': 'ambiguous_level', 'nodes': hits}
        return {'status': 'ambiguous_multiple', 'nodes': hits}

    def resolve_name(self, name, scopes):
        hits = []
        for scope in scopes:
            if scope == 'unknown':
                for candidate_scope in ('bachelor', 'graduate'):
                    hits.extend(self.by_name.get((candidate_scope, name), []))
            else:
                hits.extend(self.by_name.get((scope, name), []))
        namespaces = {hit['namespace'] for hit in hits}
        if not hits:
            return {'status': 'unresolved', 'nodes': []}
        if len({hit['name'] for hit in hits}) == 1:
            return {'status': 'resolved', 'nodes': hits}
        if len(namespaces) > 1 and len(scopes) > 1:
            return {'status': 'ambiguous_level', 'nodes': hits}
        return {'status': 'resolved', 'nodes': hits}


def load_catalog_index(catalog_root):
    index = CatalogIndex()
    bachelor = json.loads((catalog_root / 'major_bachelor_2026_official_parsed.json').read_text())
    for field in ('gates', 'categories', 'majors'):
        for node in bachelor[field]:
            index.add(bachelor['catalog_id'], 'bachelor', node['code'], node['name'], node['level'], node['id'])
    graduate = json.loads((catalog_root / 'major_graduate_2022_official_parsed.json').read_text())
    for field in ('gates', 'first_level_disciplines', 'professional_degree_categories'):
        for node in graduate[field]:
            index.add(graduate['catalog_id'], 'graduate', node['code'], node['name'], node['level'], node['id'])
    books = []
    for filename in ('major_graduate_codebook_2023_admissions_official_parsed.json',
                     'major_graduate_codebook_2024_admissions_official_parsed.json'):
        book = json.loads((catalog_root / filename).read_text())
        books.append(book)
        for node in book['nodes']:
            index.add(book['catalog_id'], 'graduate', node['code'], node['name'], node['level'], node['id'])
    selfset = json.loads((catalog_root / 'major_selfset_2026_official_parsed.json').read_text())
    selfset_names = {row['selfset_discipline_name'] for row in selfset['secondary']['rows']}
    selfset_names |= {row['selfset_discipline_name'] for row in selfset['cross']['rows']}
    return index, selfset_names, books


def compact_resolution(resolution):
    """Keep the status and node ids; every other node field is derivable from the id."""
    out = {'status': resolution['status']}
    for key in ('form', 'alias_of', 'prefix'):
        if key in resolution:
            out[key] = resolution[key]
    nodes = resolution.get('nodes') or []
    if nodes:
        out['ids'] = [node['id'] for node in nodes]
        out['names'] = sorted({node['name'] for node in nodes})
    other = resolution.get('other_scope_nodes') or []
    if other:
        out['other_scope_ids'] = [node['id'] for node in other]
    prefix_nodes = resolution.get('prefix_nodes') or []
    if prefix_nodes:
        out['prefix_ids'] = [node['id'] for node in prefix_nodes]
    return out


AGENCY_PATTERNS = [
    ('pboc', '中国人民银行'),
    ('cma', '气象'),
    ('customs', '海关'),
    ('tax', '税务'),
    ('nfra', '金融监督管理'),
    ('csrc', '证券监督管理'),
]


def agency_of(department_name):
    """Map a department to the agency system whose category vocabulary it uses."""
    for code, marker in AGENCY_PATTERNS:
        if marker in department_name:
            return code
    return None


def code_form(code):
    code = code.upper()
    if len(code) == 6 and code.endswith('00') and code[:4].isdigit():
        return 'enrollment_00_alias'
    if re.fullmatch(r'\d{6}[A-Z]', code):
        return 'six_digit_with_suffix'
    if re.fullmatch(r'\d{4}[A-Z]\d', code):
        return 'institution_local_z'
    if re.fullmatch(r'\d{4}J\d', code):
        return 'institution_local_j'
    if re.fullmatch(r'[A-Z]\d{4}[A-Z\d]', code):
        return 'selfset_degree_type_s'
    if len(code) == 7 and code.isdigit():
        return 'seven_digit'
    if len(code) == 6 and code.isdigit():
        return 'six_digit'
    if len(code) == 4 and code.isdigit():
        return 'four_digit'
    return 'other'


def resolve(code, scopes, index):
    form = code_form(code)
    if form == 'enrollment_00_alias':
        base = code[:4]
        inner = index.resolve_code(base, scopes)
        return {
            'status': 'enrollment_00_alias' if inner['status'] == 'resolved' else 'unresolved',
            'form': form,
            'alias_of': base,
            'nodes': inner['nodes'],
            'note': 'Trailing 00 is the unit enrollment form of the four-digit code, not a new major.',
        }
    if form in ('institution_local_z', 'institution_local_j', 'selfset_degree_type_s'):
        base = code[:4]
        inner = index.resolve_code(base, scopes)
        return {
            'status': 'institution_local_code',
            'form': form,
            'prefix': base,
            'prefix_nodes': inner['nodes'],
            'nodes': [],
            'note': ('The suffix is assigned by the degree-granting unit, not by a national catalog. '
                     'The roster publishes names only, so no code-to-name link is asserted.'),
        }
    result = index.resolve_code(code, scopes)
    if result['status'] == 'unresolved':
        # The code exists, but only in the other education namespace. Report that
        # explicitly instead of merging levels or calling it unknown.
        others = []
        for other_scope in ('bachelor', 'graduate'):
            if other_scope in scopes:
                continue
            others.extend(index.by_code.get((other_scope, code), []))
        if others:
            return {'status': 'outside_education_scope', 'form': form,
                    'other_scope_nodes': others, 'nodes': []}
    return {'status': result['status'], 'form': form, 'nodes': result['nodes']}


def remark_tokens(remarks, index, scopes):
    """Extract candidate major codes from 备注 with context filtering.

    备注 is dominated by telephone numbers, years and postal/area codes. A token
    is kept only when it resolves in a loaded catalog, or when it has a plausible
    major-code shape and sits next to an explicit major word.
    """
    kept = []
    rejected = collections.Counter()
    for match in TOKEN.finditer(remarks):
        token = match.group(1)
        upper = token.upper()
        start, end = match.start(), match.end()
        window = remarks[max(0, start - 20):min(len(remarks), end + 20)]
        resolution = resolve(upper, scopes, index)
        resolved = resolution['status'] in ('resolved', 'ambiguous_level', 'ambiguous_multiple',
                                            'institution_local_code')
        if YEAR_LIKE.fullmatch(token):
            rejected['year'] += 1
            continue
        if token.isdigit() and len(token) >= 7:
            if not resolved:
                rejected['long_number_probably_telephone'] += 1
                continue
        if token in AREA_CODES and not resolved:
            rejected['area_code'] += 1
            continue
        if not resolved:
            if not (CUE.search(window) and len(token) in (4, 6, 7)):
                rejected['no_major_shape_or_context'] += 1
                continue
        kept.append({
            'code': upper,
            'start': start,
            'end': end,
            'context': remarks[max(0, start - 18):min(len(remarks), end + 18)],
            'resolution': {key: resolution[key] for key in ('status', 'form', 'nodes')
                           if key in resolution},
        })
    return kept, rejected


def remark_names(remarks, index, scopes):
    """Exact catalog names immediately followed by 专业/门类/学科/类 in 备注."""
    hits = []
    for match in re.finditer(r'([一-鿿A-Za-z]{2,20}?)(专业|门类|学科|类)', remarks):
        name = match.group(1)
        resolution = index.resolve_name(name, scopes)
        if resolution['status'] == 'unresolved':
            continue
        if not CUE.search(remarks[max(0, match.start() - 12):match.start()]):
            continue
        hits.append({
            'name': name,
            'suffix': match.group(2),
            'start': match.start(),
            'end': match.end(),
            'context': remarks[max(0, match.start() - 18):min(len(remarks), match.end() + 18)],
            'resolution': {'status': resolution['status'], 'nodes': resolution['nodes']},
            'evidence_quality': 'exact_name_in_remarks_requires_review',
        })
    return hits


def gate_scope_hits(requirement, index, scopes, major_raw):
    """Resolve "X门类" and source-declared gate codes to the discipline gate node.

    Two narrow normalizations, both traceable to a published rule:

    1. "法学门类" / "工学学科门类". The Ministry of Education's own 2027
       recruitment statement says a requirement written as an 学科门类 covers
       every major and first-level discipline inside that gate. Stripping the
       printed suffix leaves an exact gate name, so this is a rule application,
       not a similarity match.
    2. "经济学类（02）" / "（专业代码前两位为02）". The position text itself
       states the two-digit gate code, so the position defines its own scope.

    Nothing else is normalized here: "理学类" (a gate name with a colloquial 类
    suffix), "会计学类" and bachelor category names inside graduate positions
    stay unresolved and are only classified.
    """
    hits = []
    seen = set()
    for term in requirement['name_references']:
        label = (term.get('name_candidate') or '').strip()
        stem = None
        if label.endswith('学科门类'):
            stem = label[:-4]
        elif label.endswith('门类'):
            stem = label[:-2]
        if not stem or stem in seen:
            continue
        resolution = index.resolve_name(stem, scopes)
        gate_nodes = [node for node in resolution['nodes'] if node['level'] == 'discipline_group']
        if not gate_nodes:
            continue
        seen.add(stem)
        hits.append({
            'name': stem,
            'printed_text': label,
            'resolution': {'status': 'resolved', 'nodes': gate_nodes},
            'resolution_method': 'gate_scope_rule',
            'rule_basis': MOE_2027_RULE,
            'node_level': 'discipline_group',
        })
    for match in re.finditer(r'([一-鿿]{2,8}?)(?:类)?[（(](?:专业代码前两位为?|代码前两位为?|为)?(\d{2})[）)]', major_raw):
        label, gate_code = match.group(1), match.group(2)
        if label in seen:
            continue
        for scope in scopes if scopes != ['unknown'] else ['bachelor', 'graduate']:
            for node in index.by_code.get((scope, gate_code), []):
                if node['level'] != 'discipline_group':
                    continue
                seen.add(label)
                hits.append({
                    'name': label,
                    'printed_text': match.group(0),
                    'resolution': {'status': 'resolved', 'nodes': [node]},
                    'resolution_method': 'source_declared_gate_code',
                    'rule_basis': 'the position text states the two-digit gate code itself',
                    'node_level': 'discipline_group',
                })
                break
    return hits


def term_name_hits(requirement, index, scopes):
    """Re-resolve the requirement's own name terms against the expanded index.

    The earlier pass could only see the 2022 directory, which has no six-digit
    graduate names. Exact names such as 世界经济 are now resolvable.
    """
    hits = []
    for term in requirement['name_references']:
        label = term.get('name_candidate')
        if not label or label not in index.names:
            continue
        # A term the earlier pass already matched adds no new evidence.
        if term['reference_kind'] == 'catalog_exact_name':
            continue
        resolution = index.resolve_name(label, scopes)
        if resolution['status'] == 'unresolved':
            continue
        hits.append({
            'name': label,
            'reference_kind_before': term['reference_kind'],
            'text': term['text'],
            'resolution': {'status': resolution['status'], 'nodes': resolution['nodes']},
            'evidence_quality': 'exact_name_term_in_major_column',
        })
    return hits


def parenthetical_names(major_raw, index, scopes):
    """Exact catalog names inside parentheses, e.g. 英语（包括英语语言文学、英语翻译）.

    The requirement parser protects parenthetical content as part of a term, so
    an exact catalog name listed inside brackets is otherwise never matched.
    Only whole names between separators are accepted.

    A bracketed list introduced by 不含/除/不包括 is an exclusion list: those
    names are recorded as exclusions and never counted as coverage.
    """
    hits = []
    for group in re.finditer(r'[（(]([^（）()]{2,120})[）)]', major_raw):
        inner = group.group(1)
        offset = group.start(1)
        lead = major_raw[max(0, group.start() - 16):group.start()]
        is_exclusion = bool(NEGATIVE.search(lead) or NEGATIVE.search(inner[:8]))
        for piece_match in re.finditer(r'[^、,，;；\s]+', inner):
            piece = piece_match.group()
            if piece in index.names:
                resolution = index.resolve_name(piece, scopes)
                if resolution['status'] == 'unresolved':
                    continue
                hits.append({
                    'name': piece,
                    'start': offset + piece_match.start(),
                    'end': offset + piece_match.end(),
                    'resolution': {'status': resolution['status'], 'nodes': resolution['nodes']},
                    'evidence_quality': 'exact_name_inside_parentheses',
                    'is_exclusion': is_exclusion,
                })
    return hits


def gate_prefixed_names(major_raw, index, scopes):
    """Names written as gate-code + name, e.g. "02经济学"."""
    hits = []
    for match in GATE_PREFIX.finditer(major_raw):
        gate = match.group(1)
        tail = major_raw[match.end():match.end() + 14]
        for cut in range(min(len(tail), 14), 1, -1):
            candidate = tail[:cut]
            if candidate in index.names:
                resolution = index.resolve_name(candidate, scopes)
                if resolution['status'] == 'unresolved':
                    continue
                actual_gates = {node['code'][:2] for node in resolution['nodes']}
                hits.append({
                    'gate_code': gate,
                    'name': candidate,
                    'start': match.start(),
                    'end': match.end() + cut,
                    'resolution': {'status': resolution['status'], 'nodes': resolution['nodes']},
                    'gate_matches_name': gate in actual_gates,
                })
                break
    return hits


def name_conflicts(text, code_spans, index, scopes):
    """Flag a printed name that sits immediately beside a code and disagrees.

    Only the token touching the code counts: the first token after it or the
    last token before it, cut at any list separator or bracket. Neighbouring
    list items must never be mistaken for the name of this code.
    """
    separators = r'[、,，;；。\s（）()\[\]【】：:]'
    conflicts = []
    for span in code_spans:
        nodes = span['resolution'].get('nodes') or []
        if not nodes:
            continue
        catalog_names = {node['name'] for node in nodes}
        after = re.split(separators, text[span['end']:span['end'] + 16], maxsplit=1)[0]
        before = re.split(separators, text[max(0, span['start'] - 16):span['start']])
        before = before[-1] if before else ''
        # A preceding token that still carries digits is a code, not a name.
        for candidate, side in ((after, 'after'), (before, 'before')):
            candidate = candidate.strip()
            if not candidate or re.search(r'[0-9]', candidate):
                continue
            if candidate in index.names and candidate not in catalog_names:
                # Three distinct situations, kept apart instead of merged into
                # one "conflict" count:
                #   1. the printed text omits the trailing 类 of a category name,
                #   2. the code names different disciplines at bachelor and
                #      graduate level,
                #   3. the printed name belongs to a different code entirely.
                if f'{candidate}类' in catalog_names:
                    other_level = []
                    conflict_class = 'category_suffix_omitted'
                else:
                    other_level = []
                    for scope in ('bachelor', 'graduate'):
                        for node in index.by_name.get((scope, candidate), []):
                            if node['code'].upper() == span['code'].upper():
                                other_level.append({
                                    'namespace': node['namespace'],
                                    'education_scope': node['education_scope'],
                                    'name': node['name'],
                                    'id': node['id'],
                                })
                    conflict_class = 'cross_level_same_code' if other_level else 'content_conflict'
                belongs_to = []
                if conflict_class == 'content_conflict':
                    for (scope_name, name_value), nodes in index.by_name.items():
                        if name_value == candidate:
                            for node in nodes:
                                belongs_to.append({'code': node['code'], 'namespace': node['namespace'],
                                                   'education_scope': node['education_scope']})
                conflicts.append({
                    'code': span['code'],
                    'catalog_names': sorted(catalog_names),
                    'printed_name': candidate,
                    'side': side,
                    'conflict_class': conflict_class,
                    'other_level_matches': other_level,
                    'printed_name_belongs_to': sorted(belongs_to, key=lambda x: (x['code'], x['namespace'])),
                    'span': [span['start'], span['end']],
                    'context': text[max(0, span['start'] - 18):min(len(text), span['end'] + 18)],
                })
    return conflicts


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--project', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--output', type=Path, default=None)
    args = parser.parse_args()
    project = args.project
    output = args.output or (project / 'data' / 'major_evidence_2027')
    catalog_root = project / 'data' / 'catalogs'

    index, selfset_names, books = load_catalog_index(catalog_root)

    positions_root = project / 'data' / 'positions_2027'
    manifest = json.loads((positions_root / 'manifest.json').read_text())
    columns = manifest['columns']
    column_index = {name: i for i, name in enumerate(columns)}
    positions = {}
    for shard in manifest['shards']:
        for row in json.loads((positions_root / shard['path']).read_text())['rows']:
            positions[row[0]] = row

    majors_manifest = json.loads((project / 'data' / 'majors_2027' / 'manifest.json').read_text())
    requirements = []
    for shard in majors_manifest['requirements']:
        requirements.extend(json.loads((project / 'data' / 'majors_2027' / shard['path']).read_text()))
    requirement_by_position = {}
    requirement_by_id = {}
    for requirement in requirements:
        requirement_by_id[requirement['id']] = requirement
        for position_id in requirement['position_ids']:
            requirement_by_position[position_id] = requirement

    code_index = collections.defaultdict(lambda: {
        'fields': collections.Counter(), 'positions': set(), 'hires': 0,
        'statuses': collections.Counter(), 'forms': collections.Counter(), 'names': set(),
    })
    records = []
    reason_counter = collections.Counter()
    conflict_class_counter = collections.Counter()
    review_reason_counter = collections.Counter()
    agency_category_positions = collections.Counter()
    review_scope = {'positions': 0, 'hires': 0, 'covered_before': 0, 'covered_after': 0}
    remarks_rejection = collections.Counter()
    conflict_records = []
    before_covered = after_covered = 0
    unrestricted_covered = 0
    new_coverage_positions = 0
    new_coverage_from = collections.Counter()

    for position_id, row in positions.items():
        raw = {name: row[column_index[name]] for name in columns}
        requirement = requirement_by_position[position_id]
        scopes = education_scopes(raw['学历'])
        hires = int(raw['招考人数'])
        unrestricted = bool(UNRESTRICTED.fullmatch(raw['专业'].strip()))

        major_codes = []
        clause_scopes = {clause['id']: clause['education_scopes'] for clause in requirement['clauses']}
        for mention in requirement['code_mentions']:
            # A code belongs to the clause it was printed in: "大学本科：030101K；
            # 研究生：0301" resolves the first code as bachelor and the second as
            # graduate, regardless of the position's overall 学历 cell.
            mention_scopes = clause_scopes.get(mention['clause_id']) or scopes
            resolution = resolve(mention['code'], mention_scopes, index)
            major_codes.append({
                'code': mention['code'],
                'clause_id': mention['clause_id'],
                'education_scopes_used': mention_scopes,
                'start': mention['start'],
                'end': mention['end'],
                'resolution': resolution,
                'clause_requires_review': mention['condition_requires_review'],
            })
        gate_names = gate_prefixed_names(raw['专业'], index, scopes)
        paren_names = parenthetical_names(raw['专业'], index, scopes)
        term_names = term_name_hits(requirement, index, scopes)
        gate_scope = gate_scope_hits(requirement, index, scopes, raw['专业'])
        remarks_codes, rejected = remark_tokens(raw['备注'], index, scopes)
        remarks_rejection.update(rejected)
        remarks_name_hits = remark_names(raw['备注'], index, scopes)

        resolved_major = [c for c in major_codes if c['resolution']['status'] in
                          ('resolved', 'ambiguous_level', 'ambiguous_multiple', 'enrollment_00_alias')]
        resolved_gate_names = [g for g in gate_names if g['resolution']['status'] in ('resolved', 'ambiguous_level')]
        resolved_paren_names = [p for p in paren_names
                                if p['resolution']['status'] in ('resolved', 'ambiguous_level')
                                and not p['is_exclusion']]
        excluded_paren_names = [p for p in paren_names if p['is_exclusion']]
        resolved_remarks = [c for c in remarks_codes if c['resolution']['status'] in
                            ('resolved', 'ambiguous_level', 'ambiguous_multiple', 'enrollment_00_alias')]

        resolved_term_names = [t for t in term_names if t['resolution']['status'] in ('resolved', 'ambiguous_level')]
        resolved_gate_scope = [g for g in gate_scope if g['resolution']['status'] == 'resolved']

        coverage_before = bool(requirement['catalog_candidate_ids'])
        # An explicitly unrestricted 专业 column needs no catalog reference; it is
        # fully specified by the word 不限 and is counted as covered, separately.
        coverage_after = bool(unrestricted or coverage_before or resolved_major or resolved_gate_names
                              or resolved_term_names or resolved_paren_names or resolved_gate_scope
                              or resolved_remarks or remarks_name_hits)
        if unrestricted:
            unrestricted_covered += 1
        if coverage_before:
            before_covered += 1
        if coverage_after:
            after_covered += 1
        if requirement['review_reasons']:
            review_scope['positions'] += 1
            review_scope['hires'] += hires
            review_scope['covered_before'] += bool(coverage_before)
            review_scope['covered_after'] += bool(coverage_after)
            for reason in requirement['review_reasons']:
                review_reason_counter[reason] += 1
        if coverage_after and not coverage_before:
            new_coverage_positions += 1
            if unrestricted:
                new_coverage_from['explicitly_unrestricted_major_column'] += 1
            elif resolved_major:
                new_coverage_from['graduate_codebook_or_new_code_resolution'] += 1
            elif resolved_gate_names:
                new_coverage_from['gate_prefixed_catalog_name'] += 1
            elif resolved_term_names:
                new_coverage_from['exact_term_name_new_catalog'] += 1
            elif resolved_gate_scope:
                new_coverage_from['documented_gate_scope_normalization'] += 1
            elif resolved_paren_names:
                new_coverage_from['parenthetical_exact_name'] += 1
            elif resolved_remarks:
                new_coverage_from['remarks_code'] += 1
            else:
                new_coverage_from['remarks_exact_name'] += 1

        reasons = []
        if unrestricted:
            reasons.append('major_text_unrestricted')
        if not major_codes and not gate_names:
            reasons.append('no_explicit_code_in_major_column')
        unresolved_major = [c for c in major_codes if c['resolution']['status'] not in
                            ('resolved', 'ambiguous_level', 'ambiguous_multiple', 'enrollment_00_alias')]
        if unresolved_major:
            if any(c['resolution']['status'] == 'institution_local_code' for c in unresolved_major):
                reasons.append('institution_local_code')
            if any(c['resolution']['status'] == 'outside_education_scope' for c in unresolved_major):
                reasons.append('code_outside_education_scope')
            if any(c['resolution']['status'] == 'unresolved' for c in unresolved_major):
                reasons.append('code_unresolved_in_loaded_catalogs')
        if any(not g['gate_matches_name'] for g in gate_names):
            reasons.append('gate_code_name_mismatch')
        if NEGATIVE.search(raw['专业']):
            reasons.append('negative_or_exclusion_present')
        if excluded_paren_names:
            reasons.append('exclusion_list_present')
        if QUALIFIER.search(raw['专业']) and not unrestricted:
            reasons.append('open_scope_or_qualifier')
        if DEGREE_WORD.search(raw['专业']) and len(requirement['clauses']) == 1 and \
                requirement['clauses'][0]['scope_basis'] != 'explicit_degree_marker':
            reasons.append('degree_word_inside_single_clause')
        if not coverage_after:
            if re.search(r'类(?:$|[、,，;；。])', raw['专业']) and not re.search(r'类[（(]', raw['专业']):
                reasons.append('category_phrase_without_exact_catalog_node')
            if not major_codes:
                reasons.append('no_machine_readable_code_in_major_column')
            if not remarks_codes and not remarks_name_hits:
                reasons.append('no_machine_readable_code_in_remarks_column')
            # A bare name such as 德语 exists in the bachelor catalog but not in
            # the graduate one. Record that instead of claiming a match.
            bare = raw['专业'].strip().strip('。；;')
            if bare and not re.search(r'[、,，;；（）()\s]', bare):
                other_levels = [scope for scope in ('bachelor', 'graduate')
                                if scope not in scopes and index.by_name.get((scope, bare))]
                if other_levels:
                    reasons.append('name_exists_only_in_other_education_level')
            # A bachelor category name used in a graduate-only position is a
            # vocabulary mismatch, not a match: the graduate catalog has no node
            # with that name. Record it separately and keep the graduate
            # equivalent only as evidence.
            for term in requirement['name_references']:
                label = (term.get('name_candidate') or '').strip()
                if not label:
                    continue
                if label.endswith('类') and 'graduate' in scopes and 'bachelor' not in scopes \
                        and index.by_name.get(('bachelor', label)):
                    if 'bachelor_category_name_in_graduate_position' not in reasons:
                        reasons.append('bachelor_category_name_in_graduate_position')
                if label.endswith('类') and label not in index.names:
                    # Only a discipline gate (not a professional degree category
                    # such as 气象 0751) can absorb a colloquial 类 suffix.
                    stem_scope = scopes[0] if len(scopes) == 1 else 'bachelor'
                    if any(node['level'] == 'discipline_group'
                           for node in index.by_name.get((stem_scope, label[:-1]), [])):
                        if 'colloquial_gate_name_with_类_suffix' not in reasons:
                            reasons.append('colloquial_gate_name_with_类_suffix')
            # Agency-internal category vocabulary with no published membership
            # table. The agency is recorded so the case can be chased, not
            # guessed.
            # Only vocabulary that exists in no catalog at all is agency-internal.
            # 中国语言文学类 is an official bachelor category and is classified
            # as a level mismatch instead.
            unknown_labels = [label for label in
                              ((t.get('name_candidate') or '').strip() for t in requirement['name_references'])
                              if label.endswith('类') and label not in index.names]
            agency = agency_of(raw['部门名称'])
            if agency and unknown_labels:
                reasons.append('agency_category_without_published_membership')
                agency_category_positions[agency] += 1
        for reason in reasons:
            reason_counter[reason] += 1

        conflicts = []
        all_spans = major_codes + remarks_codes
        for conflict in name_conflicts(raw['专业'], [c for c in major_codes], index, scopes):
            conflict['field'] = '专业'
            conflicts.append(conflict)
        for conflict in name_conflicts(raw['备注'], [c for c in remarks_codes], index, scopes):
            conflict['field'] = '备注'
            conflicts.append(conflict)
        if conflicts:
            conflicts = conflicts[:6]
            conflict_records.append({'id': position_id, 'conflicts': conflicts})
            reason_counter['code_name_conflict'] += 1
            for conflict in conflicts:
                conflict_class_counter[conflict['conflict_class']] += 1

        for code in major_codes + remarks_codes:
            entry = code_index[code['code']]
            entry['fields']['专业' if code in major_codes else '备注'] += 1
            entry['positions'].add(position_id)
            entry['statuses'][code['resolution']['status']] += 1
            entry['forms'][code['resolution']['form']] += 1
            for node in code['resolution'].get('nodes', []):
                entry['names'].add(node['name'])

        record = {
            'id': position_id,
            'hires': hires,
            'education_raw': raw['学历'],
            'education_scopes': scopes,
            'requirement_id': requirement['id'],
            'coverage_before': coverage_before,
            'coverage_after': coverage_after,
            'major_codes': [
                {'code': code['code'], 'clause_id': code['clause_id'],
                 'education_scopes_used': code['education_scopes_used'],
                 'start': code['start'], 'end': code['end'],
                 'resolution': compact_resolution(code['resolution'])}
                for code in major_codes
            ],
            'major_gate_prefixed_names': [
                {'gate_code': hit['gate_code'], 'name': hit['name'],
                 'gate_matches_name': hit['gate_matches_name'],
                 'resolution': compact_resolution(hit['resolution'])}
                for hit in gate_names
            ],
            'major_parenthetical_names': [
                {'name': hit['name'], 'is_exclusion': hit['is_exclusion'],
                 'resolution': compact_resolution(hit['resolution'])}
                for hit in paren_names
            ],
            'major_term_name_hits': [
                {'name': hit['name'], 'reference_kind_before': hit['reference_kind_before'],
                 'resolution': compact_resolution(hit['resolution'])}
                for hit in term_names
            ],
            'major_gate_scope_hits': [
                {'name': hit['name'], 'printed_text': hit['printed_text'],
                 'resolution_method': hit['resolution_method'],
                 'rule_basis': hit['rule_basis'],
                 'resolution': compact_resolution(hit['resolution'])}
                for hit in gate_scope
            ],
            'major_excluded_names': sorted({hit['name'] for hit in excluded_paren_names}),
            'remarks_codes': [
                {'code': code['code'], 'start': code['start'], 'end': code['end'],
                 'context': code['context'],
                 'resolution': compact_resolution(code['resolution'])}
                for code in remarks_codes
            ],
            'remarks_exact_names': [
                {'name': hit['name'], 'suffix': hit['suffix'], 'context': hit['context'],
                 'resolution': compact_resolution(hit['resolution'])}
                for hit in remarks_name_hits
            ],
            'reason_classes': reasons,
            'conflicts': conflicts,
        }
        record = {key: value for key, value in record.items() if value not in ([], None, '')}
        records.append(record)

    # Cross-field de-duplication: one position counted once per complete code,
    # while both field origins stay visible.
    cross_field = {}
    for record in records:
        codes = {}
        for code in record.get('major_codes', []):
            codes.setdefault(code['code'], {'fields': set(), 'statuses': set()})
            codes[code['code']]['fields'].add('专业')
            codes[code['code']]['statuses'].add(code['resolution']['status'])
        for code in record.get('remarks_codes', []):
            codes.setdefault(code['code'], {'fields': set(), 'statuses': set()})
            codes[code['code']]['fields'].add('备注')
            codes[code['code']]['statuses'].add(code['resolution']['status'])
        if codes:
            cross_field[record['id']] = {code: sorted(value['fields']) for code, value in codes.items()}

    code_positions = collections.defaultdict(lambda: {'positions': [], 'fields': collections.Counter(),
                                                      'statuses': collections.Counter(), 'forms': collections.Counter(),
                                                      'names': set()})
    for record in records:
        for code in record.get('major_codes', []):
            entry = code_positions[code['code']]
            entry['positions'].append(record['id'])
            entry['fields']['专业'] += 1
            entry['statuses'][code['resolution']['status']] += 1
            entry['forms'][code['resolution'].get('form', 'n/a')] += 1
            for name in code['resolution'].get('names', []):
                entry['names'].add(name)
        for code in record.get('remarks_codes', []):
            entry = code_positions[code['code']]
            entry['positions'].append(record['id'])
            entry['fields']['备注'] += 1
            entry['statuses'][code['resolution']['status']] += 1
            entry['forms'][code['resolution'].get('form', 'n/a')] += 1
            for name in code['resolution'].get('names', []):
                entry['names'].add(name)

    hires_by_id = {record['id']: record['hires'] for record in records}
    code_index_records = []
    for code in sorted(code_positions):
        entry = code_positions[code]
        unique_positions = sorted(set(entry['positions']))
        code_index_records.append({
            'code': code,
            'positions': len(unique_positions),
            'mentions': len(entry['positions']),
            'hires': sum(hires_by_id[position_id] for position_id in unique_positions),
            'fields': dict(entry['fields']),
            'statuses': dict(entry['statuses']),
            'forms': dict(entry['forms']),
            'catalog_names': sorted(entry['names']),
            'position_ids': unique_positions,
        })

    output.mkdir(parents=True, exist_ok=True)

    def shard(name, items, limit=820_000):
        parts, bucket, size = [], [], 0
        for item in items:
            encoded = json.dumps(item, ensure_ascii=False, separators=(',', ':'))
            length = len(encoded.encode('utf-8')) + 2
            if bucket and size + length > limit:
                path = output / f'{name}-{len(parts) + 1:02d}.json'
                dump(path, bucket)
                parts.append({'path': path.name, 'records': len(bucket),
                              'bytes': path.stat().st_size,
                              'sha256': sha256(path.read_bytes())})
                bucket, size = [], 0
            bucket.append(item)
            size += length
        if bucket:
            path = output / f'{name}-{len(parts) + 1:02d}.json'
            dump(path, bucket)
            parts.append({'path': path.name, 'records': len(bucket),
                          'bytes': path.stat().st_size, 'sha256': sha256(path.read_bytes())})
        return parts

    position_parts = shard('position-evidence', records)
    code_parts = shard('code-evidence', code_index_records)

    residual = [record for record in records if not record['coverage_after']]
    residual_parts = shard('residual', [
        {'id': record['id'], 'hires': record['hires'],
         'department_name': positions[record['id']][column_index['部门名称']],
         'major_raw': positions[record['id']][column_index['专业']],
         'reason_classes': record.get('reason_classes', [])}
        for record in residual
    ])

    reason_by_residual = collections.Counter()
    for record in residual:
        for reason in record.get('reason_classes', []):
            reason_by_residual[reason] += 1

    residual_text = collections.Counter()
    residual_text_positions = collections.Counter()
    for record in residual:
        row = positions[record['id']]
        raw_text = row[column_index['专业']]
        residual_text[raw_text] += 1
        residual_text_positions[raw_text] += record['hires']
    top_residual_texts = [
        {'major_raw': text, 'positions': count, 'hires': residual_text_positions[text]}
        for text, count in residual_text.most_common(30)
    ]
    residual_by_department = collections.Counter()
    for record in residual:
        residual_by_department[positions[record['id']][column_index['部门名称']]] += 1

    remarks_stats = {
        'positions_with_any_remarks_code': sum(1 for r in records if r.get('remarks_codes')),
        'positions_with_resolved_remarks_code': sum(
            1 for r in records if any(c['resolution']['status'] in
                                      ('resolved', 'ambiguous_level', 'ambiguous_multiple', 'enrollment_00_alias')
                                      for c in r.get('remarks_codes', []))),
        'positions_with_remarks_exact_name': sum(1 for r in records if r.get('remarks_exact_names')),
        'positions_with_major_code_and_remarks_code': sum(
            1 for r in records if r.get('major_codes') and r.get('remarks_codes')),
        'rejected_remark_tokens': dict(remarks_rejection),
    }

    summary = {
        'positions': len(records),
        'hires': sum(record['hires'] for record in records),
        'coverage_before': {
            'positions_with_catalog_candidate': before_covered,
            'positions_without_catalog_candidate': len(records) - before_covered,
            'source': 'data/majors_2027 manifest summary (专业 column only)',
        },
        'coverage_after': {
            'positions_with_catalog_candidate': after_covered,
            'positions_without_catalog_candidate': len(records) - after_covered,
            'basis': ('专业 column codes resolved against five catalogs, gate-prefixed exact names, '
                      '备注 codes and 备注 exact names'),
        },
        'unrestricted_positions_counted_as_covered': unrestricted_covered,
        'newly_covered_positions': new_coverage_positions,
        'newly_covered_by_basis': dict(new_coverage_from),
        'residual_positions': len(residual),
        'residual_hires': sum(record['hires'] for record in residual),
        'residual_reason_counts': dict(reason_by_residual),
        'residual_top_texts': top_residual_texts,
        'residual_top_departments': [
            {'department_name': name, 'positions': count}
            for name, count in residual_by_department.most_common(15)
        ],
        'position_reason_counts': dict(reason_counter),
        'conflicts': {'positions': len(conflict_records),
                      'by_class': dict(conflict_class_counter),
                      'details_sharded_in': 'position-evidence records with a non-empty conflicts list'},
        'agency_category_positions': dict(agency_category_positions),
        'review_scope': {
            **review_scope,
            'still_without_candidate': review_scope['positions'] - review_scope['covered_after'],
            'requirement_review_reasons': dict(review_reason_counter),
            'note': ('Positions whose requirement text carries at least one review reason. '
                     'Coverage is a catalog reference, never a full interpretation.'),
        },
        'distinct_codes_across_fields': len(code_index_records),
        'remarks': remarks_stats,
        'eligibility_evaluated': False,
    }

    manifest_out = {
        'schema_version': '1.0.0',
        'as_of': '2026-10-18',
        'dataset_id': 'national-civil-service-major-evidence-2027',
        'purpose': ('Per-position major evidence across the 专业 and 备注 columns, with explicit '
                    'code spans, education namespaces and reason classes. Not an eligibility engine.'),
        'source_position_manifest': '../positions_2027/manifest.json',
        'source_requirement_manifest': '../majors_2027/manifest.json',
        'catalogs': [
            '../catalogs/major_bachelor_2026_official_parsed.json',
            '../catalogs/major_graduate_2022_official_parsed.json',
            '../catalogs/major_graduate_codebook_2023_admissions_official_parsed.json',
            '../catalogs/major_graduate_codebook_2024_admissions_official_parsed.json',
            '../catalogs/major_selfset_2026_official_parsed.json',
        ],
        'summary': summary,
        'normalization_rules': [
            {
                'id': 'gate_scope_rule',
                'rule': ('专业要求写作“X门类”或“X学科门类”时，按 X 学科门类节点解析；'
                         '不据此判定个人可报。'),
                'basis': MOE_2027_RULE,
            },
            {
                'id': 'source_declared_gate_code',
                'rule': '原文自带两位门类代码（如“经济学类（02）”）时，按该门类节点解析。',
                'basis': 'position text itself',
            },
        ],
        'reason_taxonomy': {
            'major_text_unrestricted': '专业 column is exactly 不限/无限制/专业不限/不限专业',
            'no_explicit_code_in_major_column': 'no four-to-seven digit token in 专业',
            'institution_local_code': 'Z/J/S style code; suffix is assigned by the granting unit',
            'code_outside_education_scope': ('the code exists in the other education namespace only; '
                                              'levels are not merged and it is not counted as coverage'),
            'code_unresolved_in_loaded_catalogs': 'code form recognized but no catalog node has it',
            'gate_code_name_mismatch': 'printed two-digit gate code disagrees with the name after it',
            'negative_or_exclusion_present': '专业 text contains an exclusion expression',
            'open_scope_or_qualifier': '专业 text contains 相关/等专业/方向/仅限 style wording',
            'degree_word_inside_single_clause': 'a degree word sits inside an undivided clause',
            'category_phrase_without_exact_catalog_node': 'text ends a phrase in 类 with no exact catalog node',
            'no_machine_readable_code_in_major_column': 'no code recovered from 专业',
            'no_machine_readable_code_in_remarks_column': 'no code or exact name recovered from 备注',
            'name_exists_only_in_other_education_level': ('a bare name has an exact catalog node only at a '
                                                          'different education level, which is not treated as a match'),
            'bachelor_category_name_in_graduate_position': ('the text uses a bachelor category name in a '
                                                            'graduate-only position; the graduate catalog has no node with that name'),
            'colloquial_gate_name_with_类_suffix': ('a discipline-gate name written with a 类 suffix, e.g. 理学类; '
                                                    'not an official category and not normalized'),
            'agency_category_without_published_membership': ('the agency uses an in-house category phrase such as '
                                                             '经济金融类 or 气象类 and publishes no membership list'),
            'code_name_conflict': 'a printed name next to a code disagrees with the catalog name',
        },
        'field_semantics': {
            '专业': 'position requirement text, original string',
            '备注': 'position remarks text, original string; telephone numbers, years and area codes are filtered out',
        },
        'cross_field_dedup': 'A position is counted once per complete code; both field origins are kept.',
        'position_evidence': position_parts,
        'code_evidence': code_parts,
        'residual': residual_parts,
        'semantics': {
            'catalog_candidate': ('An exact code or exact catalog name was found in a compatible education '
                                  'namespace. This is not a full interpretation of the requirement and not '
                                  'an applicant eligibility result.'),
            'new_catalogs': ('The two graduate enrollment code books are the only public documents that '
                             'enumerate six-digit graduate secondary codes; the 2026 self-set roster '
                             'publishes names only and confers no code.'),
            'no_fuzzy_matching': 'Names match only exactly; 会计学类 is not treated as 会计学.',
            'additivity': 'A position can carry several codes; code counts never sum to national totals.',
        },
        'builder': '../scripts/build_major_evidence.py',
    }
    dump(output / 'manifest.json', manifest_out)
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    print(json.dumps({'manifest_bytes': (output / 'manifest.json').stat().st_size}, ensure_ascii=False))


if __name__ == '__main__':
    main()
