#!/usr/bin/env python3
"""Verify the 2027 national position table against the official 招考简章 workbook.

Usage:
  python3 verify_official_national_table.py --workspace /path/to/inputs \
      --output ../../research/OFFICIAL_NATIONAL_TABLE_VERIFICATION_20261018.json

The official attachment is the 招考简章 zip published on the Ministry of Human
Resources exam portal (bm.scs.gov.cn/kl2027). It contains one .xls workbook that
is the national 职位表. This script joins it to the committed position shards on
the composite key 年度:部门代码:职位代码 and compares every original field.

Inputs are hash-pinned. Nothing is written outside the report path.
"""
import argparse
import hashlib
import json
import re
import tempfile
import zipfile
from pathlib import Path

ZIP_NAME = 'zhaokao_jianzhang_2027.zip'
OFFICIAL = {
    'id': 'national_2027_official_zhaokao_jianzhang',
    'portal_url': 'http://bm.scs.gov.cn/kl2027',
    'portal_redirect': 'http://bm.scs.gov.cn/pp/gkweb/core/web/ui/business/home/gkhome.html',
    'resource_list_api': 'http://dl.scs.gov.cn/api/res/8a81f6eca0221f1401a0242759fc0000/1110',
    'download_url': 'http://dl.scs.gov.cn/download/8a81f6d1a129c3d401a133dca26b00d2',
    'resource_id': '8a81f6d1a129c3d401a133dca26b00d2',
    'resource_name': '中央机关及其直属机构2027年度考试录用公务员招考简章.zip',
    'zip_sha256': 'bbe7fb85ac4ab2932672203392ef5f1756a454dab54346f0fb42286a874c1831',
    'zip_bytes': 1_764_109,
    'workbook_filename': '中央机关及其直属机构2027年度考试录用公务员招考简章.xls',
    'workbook_sha256': '6b3da70baabe31a4a202c6b1179040db7003a956bc85c79cd35e3fb739d9520a',
    'workbook_bytes': 9_654_272,
    'retrieval_date': '2026-10-18',
    'source_level': 'recruiting_authority_official_attachment',
}

RAW_COLUMNS = [
    '部门代码', '部门名称', '用人司局', '机构性质', '招考职位', '职位属性',
    '职位分布', '职位简介', '职位代码', '机构层级', '考试类别', '招考人数',
    '专业', '学历', '学位', '政治面貌', '基层工作最低年限',
    '服务基层项目工作经历', '是否在面试阶段组织专业能力测试', '面试人员比例',
    '工作地点', '落户地点', '备注', '部门网站', '咨询电话1', '咨询电话2', '咨询电话3',
]


def sha256_bytes(data):
    return hashlib.sha256(data).hexdigest()


def check(condition, message):
    if not condition:
        raise ValueError(message)


def read_official_workbook(zip_path):
    data = zip_path.read_bytes()
    check(len(data) == OFFICIAL['zip_bytes'], f'official zip byte length changed: {len(data)}')
    check(sha256_bytes(data) == OFFICIAL['zip_sha256'], 'official zip SHA-256 mismatch')
    with zipfile.ZipFile(zip_path) as archive:
        names = archive.namelist()
        check(len(names) == 1, f'official zip should hold one workbook, found {names}')
        check(names[0] == OFFICIAL['workbook_filename'], f'unexpected workbook name {names[0]}')
        payload = archive.read(names[0])
    check(len(payload) == OFFICIAL['workbook_bytes'], f'workbook byte length changed: {len(payload)}')
    check(sha256_bytes(payload) == OFFICIAL['workbook_sha256'], 'workbook SHA-256 mismatch')
    import xlrd
    with tempfile.TemporaryDirectory() as directory:
        path = Path(directory) / names[0]
        path.write_bytes(payload)
        book = xlrd.open_workbook(str(path))
        rows = []
        sheets = []
        for sheet in book.sheets():
            if sheet.nrows < 2:
                continue
            headers = sheet.row_values(1)
            check(headers == RAW_COLUMNS, f'unexpected headers in {sheet.name}')
            count = 0
            hires = 0
            for index in range(2, sheet.nrows):
                values = [
                    str(int(value)) if isinstance(value, float) and value.is_integer()
                    else ('' if value is None else str(value))
                    for value in sheet.row_values(index)
                ]
                if not values[0]:
                    continue
                rows.append({
                    'sheet': sheet.name,
                    'source_row': index + 1,
                    'raw': dict(zip(headers, values)),
                })
                count += 1
                hires += int(values[RAW_COLUMNS.index('招考人数')])
            sheets.append({'sheet': sheet.name, 'positions': count, 'hires': hires})
    return rows, sheets


def read_committed(positions_dir):
    manifest = json.loads((positions_dir / 'manifest.json').read_text())
    columns = manifest['columns']
    index = {name: position for position, name in enumerate(columns)}
    rows = {}
    for shard in manifest['shards']:
        content = json.loads((positions_dir / shard['path']).read_text())
        for row in content['rows']:
            rows[row[index['id']]] = row
    return manifest, index, rows


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--workspace', type=Path, required=True)
    parser.add_argument('--project', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--output', type=Path, default=None)
    args = parser.parse_args()
    project = args.project
    positions_dir = project / 'data' / 'positions_2027'
    report_path = args.output or (project / 'research' / 'OFFICIAL_NATIONAL_TABLE_VERIFICATION_20261018.json')

    official_rows, official_sheets = read_official_workbook(args.workspace / ZIP_NAME)
    manifest, index, committed = read_committed(positions_dir)

    official = {}
    for row in official_rows:
        key = f"2027:{row['raw']['部门代码']}:{row['raw']['职位代码']}"
        check(key not in official, f'official duplicate composite key {key}')
        official[key] = row

    missing_in_official = sorted(set(committed) - set(official))
    extra_in_official = sorted(set(official) - set(committed))
    check(not missing_in_official, f'{len(missing_in_official)} committed positions absent from the official workbook')
    check(not extra_in_official, f'{len(extra_in_official)} official positions absent from the committed shards')

    field_differences = []
    location_differences = []
    compared_cells = 0
    for key, row in sorted(official.items()):
        committed_row = committed[key]
        for column in RAW_COLUMNS:
            compared_cells += 1
            if row['raw'][column] != committed_row[index[column]]:
                field_differences.append({
                    'id': key,
                    'field': column,
                    'official': row['raw'][column],
                    'committed': committed_row[index[column]],
                })
        if row['sheet'] != committed_row[index['source_sheet']] or \
                row['source_row'] != committed_row[index['source_row']]:
            location_differences.append({
                'id': key,
                'official': [row['sheet'], row['source_row']],
                'committed': [committed_row[index['source_sheet']], committed_row[index['source_row']]],
            })

    hires_official = sum(int(row['raw']['招考人数']) for row in official.values())
    hires_committed = sum(int(row[index['招考人数']]) for row in committed.values())
    check(hires_official == hires_committed == 35_691, 'national hire total mismatch')
    check(len(official) == len(committed) == 19_426, 'national position total mismatch')
    check(not field_differences, f'{len(field_differences)} field differences against the official workbook')
    check(not location_differences, f'{len(location_differences)} workbook-location differences')

    report = {
        'schema_version': '1.0.0',
        'audit_name': 'official_national_2027_position_table_verification',
        'generated_at_utc': __import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat(),
        'generated_date_timezone': 'Asia/Shanghai',
        'source': OFFICIAL,
        'method': {
            'join_key': ['年度', '部门代码', '职位代码'],
            'key_serialization': '2027:<six-digit department code>:<twelve-digit position code>',
            'text_comparison': 'exact Unicode string equality',
            'numeric_handling': 'integral Excel floats rendered as decimal strings, same rule on both sides',
            'blank_handling': 'empty cell becomes the empty string on both sides',
            'workbook_location_compared': 'source_sheet and source_row',
            'read_only': True,
        },
        'scope': {
            'national_positions_compared': len(official),
            'national_hires_compared': hires_official,
            'original_fields_per_position': len(RAW_COLUMNS),
            'compared_cells': compared_cells,
            'content_difference_cells': len(field_differences),
            'workbook_location_differences': len(location_differences),
            'compared_sheets': official_sheets,
        },
        'result': {
            'status': 'PASS',
            'all_19_426_positions_cell_equal': True,
            'all_27_fields_equal': True,
            'hires_conserved': True,
            'statement': ('Every one of the 19,426 2027 positions matches the official 招考简章 workbook '
                          'cell for cell across all 27 original fields, including workbook sheet and row.'),
        },
        'limitations': [
            'This verifies the national workbook published on the exam portal on 2026-10-18 against the '
            'committed mirror-derived shards. It does not verify later amendments or corrections.',
            'It does not produce applicant eligibility, and it does not verify the major catalogs.',
            'Department-specific attachments verified in earlier rounds remain separate evidence; this '
            'national workbook supersedes their coverage for the fields it contains.',
        ],
        'supersedes': {
            'prior_subset_verification_positions': 805,
            'prior_subset_verification_hires': 1501,
            'note': ('The 805-position figure covered three department attachments only. The official '
                     'national workbook covers all 19,426 positions and is recorded separately.'),
        },
    }
    report_path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(report, ensure_ascii=False, indent=2) + '\n'
    report_path.write_text(text, encoding='utf-8')
    print(json.dumps({
        'report': str(report_path),
        'bytes': report_path.stat().st_size,
        'sha256': sha256_bytes(report_path.read_bytes()),
        'positions': len(official),
        'hires': hires_official,
        'compared_cells': compared_cells,
        'content_differences': len(field_differences),
        'location_differences': len(location_differences),
    }, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
