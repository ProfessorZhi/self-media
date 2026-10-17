#!/usr/bin/env python3
"""Build lossless 2027 position shards and conservative 2024–2027 aggregates.

Usage:
  python scripts/build_position_foundation.py --workspace /path/to/source/files

The workspace needs 2027_positions_mirror.xls and {2024..2027}_position_source.csv.
Input URLs, byte lengths and SHA-256 hashes are pinned below and in the outputs.
If the audited raw_positions_extracted.json is present it is used after hashing;
otherwise install xlrd and the original XLS is read directly. No network calls.
No derived eligibility, age, grassroots-years or compensation scores are used.
"""

import argparse
import collections
import csv
import hashlib
import json
import re
from pathlib import Path


RAW_COLUMNS = [
    '部门代码', '部门名称', '用人司局', '机构性质', '招考职位', '职位属性',
    '职位分布', '职位简介', '职位代码', '机构层级', '考试类别', '招考人数',
    '专业', '学历', '学位', '政治面貌', '基层工作最低年限',
    '服务基层项目工作经历', '是否在面试阶段组织专业能力测试', '面试人员比例',
    '工作地点', '落户地点', '备注', '部门网站', '咨询电话1', '咨询电话2', '咨询电话3',
]
META_COLUMNS = [
    'id', 'year', 'source_sheet', 'source_row',
    'source_csv_province', 'source_system_tag',
]
COLUMNS = META_COLUMNS + RAW_COLUMNS
DATASET_ID = 'national-civil-service-positions-2027'
SHARD_LIMIT = 880_000  # Exact UTF-8 file size, safely below 900 KB.
PROVINCES = sorted([
    '北京', '天津', '河北', '山西', '内蒙古', '辽宁', '吉林', '黑龙江', '上海',
    '江苏', '浙江', '安徽', '福建', '江西', '山东', '河南', '湖北', '湖南',
    '广东', '广西', '海南', '重庆', '四川', '贵州', '云南', '西藏', '陕西',
    '甘肃', '青海', '宁夏', '新疆',
])
CSV_SPECS = {
    2024: (18_948, 39_561, 15_560_493, 'f6ce38cd51b402843a03a88ffb0c71983deac697e86ed117f6088e9fe1030787'),
    2025: (20_810, 39_721, 17_465_825, 'da841da75f7177b904afe72b4a1054001a701500018b7b3ab2f77d3bdaf1ae2e'),
    2026: (20_714, 38_119, 17_494_070, '2186edb16faeca9aa7ab237c270c60e0c8092e25b20726f88ece7735481301b6'),
    2027: (19_426, 35_691, 16_540_630, '2777e58a84265f8354e1c34aa40f201b8ebb450017b9842ffb3cbc152557d492'),
}
MIRROR = {
    'id': 'national_2027_workbook_mirror',
    'filename': '2027_positions_mirror.xls',
    'url': 'https://sdrcjy.com.cn/d/file/content/2026/10/6acdca6f71e60.xls',
    'bytes': 9_657_856,
    'sha256': 'a06e907c4544ac9f20e72a6532e7aa45d9a474e33a737a70953073230b026d83',
    'source_level': 'public_mirror_of_national_recruitment_workbook',
    'role': 'all_27_source_fields_and_workbook_row_locations',
}
UPSTREAM_XLSX = {
    'id': 'national_2027_upstream_conversion',
    'filename': '2027_positions_upstream.xlsx',
    'url': 'https://raw.githubusercontent.com/icy-bean/civil-exam/main/raw/national/2027/position_all.xlsx',
    'bytes': 3_292_053,
    'sha256': '8629eef3374946a56d896eedc74581337b640b1326d7433e1e65a0ff6e337808',
    'source_level': 'third_party_workbook_conversion',
    'role': 'recorded_full_table_cross_check',
}
SHANGHAI_OFFICIAL = {
    'id': 'shanghai_tax_2027_official',
    'filename': '2027_shanghai_tax_official.xlsx',
    'url': 'https://shanghai.chinatax.gov.cn/xxgk/rsxx/202610/P020261015403121292563.xlsx',
    'bytes': 36_231,
    'sha256': '19988b2e73718538eaa9294062e43383ea447d81b375c70652f443bad2c56814',
    'source_level': 'recruiting_department_official_attachment',
    'role': 'recorded_shanghai_tax_subset_cross_check',
}
EXTRACTED_SHA256 = '9bb70a26fddb3ea94a6c10c029e50ddf0b7603ddb865968f9e47282a6f03fbc3'
OFFICIAL_NATIONAL = {
    'id': 'national_2027_official_zhaokao_jianzhang',
    'filename': 'zhaokao_jianzhang_2027.zip',
    'url': 'http://dl.scs.gov.cn/download/8a81f6d1a129c3d401a133dca26b00d2',
    'portal_url': 'http://bm.scs.gov.cn/kl2027',
    'resource_name': '中央机关及其直属机构2027年度考试录用公务员招考简章.zip',
    'workbook_filename': '中央机关及其直属机构2027年度考试录用公务员招考简章.xls',
    'bytes': 1_764_109,
    'sha256': 'bbe7fb85ac4ab2932672203392ef5f1756a454dab54346f0fb42286a874c1831',
    'workbook_bytes': 9_654_272,
    'workbook_sha256': '6b3da70baabe31a4a202c6b1179040db7003a956bc85c79cd35e3fb739d9520a',
    'source_level': 'recruiting_authority_official_attachment',
    'role': 'national_official_workbook_cell_verified_against_this_dataset',
    'retrieval_date': '2026-10-18',
}
RECORDED_VERIFICATION = {
    'method': 'join_by_original_department_code_and_position_code_then_compare_available_original_fields',
    'mirror_vs_upstream_xlsx': {'positions': 19_426, 'hires': 35_691, 'compared_fields_per_position': 27, 'different_cells': 0},
    'mirror_vs_shanghai_official': {
        'positions': 224, 'hires': 400, 'compared_fields_per_position': 27,
        'compared_cells': 6_048, 'different_cells': 0,
        'prior_audit_report_sha256': 'b700b9d69eb31f5c6ee15500e7050487cae57a0538c2ca85392f15334335cad2',
    },
    'mirror_vs_official_subsets_combined': {
        'positions': 805, 'hires': 1_501, 'compared_cells': 21_713,
        'content_difference_cells': 0,
        'current_round': {'positions': 581, 'hires': 1_101, 'compared_cells': 15_665},
        'included_prior_shanghai_tax': {'positions': 224, 'hires': 400, 'compared_cells': 6_048},
        'comparable_fields_note': '按各官方附件实际提供的原字段比较；教育部 11 岗各 25 字段，其余已核验岗位各 27 字段。',
        'pdf_scope_only_positions_included': False,
    },
    'audit_report_path': '../../research/OFFICIAL_ROW_CROSSCHECK_20261017.json',
    'audit_report_path_base': 'positions_2027_manifest_directory',
    'audit_report_sha256': '0742e51bf63dec946a29ad858d92bc1dd34ec705965e42ba2d6853735155620b',
    'audit_generated_at_utc': '2026-10-16T19:23:16.232762+00:00',
    'audit_filename_date_timezone': 'Asia/Shanghai',
    'official_national_workbook': {
        'source_id': 'national_2027_official_zhaokao_jianzhang',
        'positions': 19_426,
        'hires': 35_691,
        'compared_fields_per_position': 27,
        'compared_cells': 524_502,
        'content_difference_cells': 0,
        'workbook_location_differences': 0,
        'verification_script': '../../scripts/verify_official_national_table.py',
        'report_path': '../../research/OFFICIAL_NATIONAL_TABLE_VERIFICATION_20261018.json',
        'report_sha256': '0d3cfd490bfe495de349f2ea85930913f2b384918c2cfbad144503bf3f9e88e6',
        'verified_at': '2026-10-18',
        'scope_note': ('全表对官方招考简章工作簿逐格核验：19,426 岗、35,691 名额、27 原字段、'
                       '524,502 单元格，内容差异 0，工作表与行号差异 0。'),
    },
    'scope_note': '全国主表取自公开镜像，与上游转换表 27 字段一致。官方机构附件逐格核验累计覆盖 805 岗、1,501 个名额、21,713 个可比较单元格，内容差异为 0；核验范围仅为相应机构子集，未将全国主表标为官方直链逐格认证。',
    'rebuild_note': '这里保存已完成的来源交叉核对结果；本构建脚本负责输入哈希、岗位键、原文字段保全、分片回读和统计加总。',
}


def encode(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':')).encode('utf-8')


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def check(condition, message):
    if not condition:
        raise ValueError(message)


def dump(path, value, pretty=False):
    path.parent.mkdir(parents=True, exist_ok=True)
    data = (json.dumps(value, ensure_ascii=False, indent=2).encode('utf-8') if pretty else encode(value)) + b'\n'
    path.write_bytes(data)
    return {'path': path.name, 'bytes': len(data), 'sha256': sha256(data)}


def validate_source(path, expected_bytes, expected_sha256):
    data = path.read_bytes()
    check(len(data) == expected_bytes, f'{path.name}: unexpected byte length {len(data)}')
    check(sha256(data) == expected_sha256, f'{path.name}: SHA-256 mismatch')
    return data


def csv_source(year):
    positions, hires, size, digest = CSV_SPECS[year]
    return {
        'id': f'upstream_csv_{year}', 'filename': f'{year}_position_source.csv',
        'url': f'https://raw.githubusercontent.com/icy-bean/civil-exam/main/clean/national/{year}_position.csv',
        'github_url': f'https://github.com/icy-bean/civil-exam/blob/main/clean/national/{year}_position.csv',
        'bytes': size, 'sha256': digest,
        'source_level': 'third_party_cleaned_position_table',
        'positions': positions, 'hires': hires,
    }


def read_csv(workspace, year):
    descriptor = csv_source(year)
    path = workspace / descriptor['filename']
    validate_source(path, descriptor['bytes'], descriptor['sha256'])
    with path.open(encoding='utf-8-sig', newline='') as handle:
        reader = csv.DictReader(handle)
        check(len(reader.fieldnames or []) == 35, f'{year}: unexpected CSV field count')
        rows = list(reader)
    keys = set()
    for index, row in enumerate(rows, 1):
        check(None not in row and all(value is not None for value in row.values()), f'{year}: malformed CSV record {index}')
        check(row['year'] == str(year), f'{year}: year mismatch at CSV record {index}')
        check(re.fullmatch(r'[0-9]{1,6}', row['dept_code']) is not None, f'{year}: invalid CSV department code')
        check(re.fullmatch(r'[0-9]{12}', row['position_code']) is not None, f'{year}: invalid CSV position code')
        key = f"{year}:{row['dept_code'].zfill(6)}:{row['position_code']}"
        check(key not in keys, f'{year}: duplicate composite key {key}')
        keys.add(key)
        check(re.fullmatch(r'[0-9]+', row['headcount']) is not None and int(row['headcount']) > 0, f'{year}: invalid headcount')
        check(row['work_province'] in PROVINCES, f'{year}: unknown province annotation')
    check(len(rows) == descriptor['positions'], f'{year}: position count mismatch')
    check(sum(int(row['headcount']) for row in rows) == descriptor['hires'], f'{year}: hires mismatch')
    check(sorted({row['work_province'] for row in rows}) == PROVINCES, f'{year}: province coverage mismatch')
    return rows


def read_raw(workspace):
    validate_source(workspace / MIRROR['filename'], MIRROR['bytes'], MIRROR['sha256'])
    cached = workspace / 'raw_positions_extracted.json'
    if cached.exists():
        data = cached.read_bytes()
        check(sha256(data) == EXTRACTED_SHA256, 'Audited extraction JSON SHA-256 mismatch')
        rows = json.loads(data)
    else:
        import xlrd  # Only needed when rebuilding directly from the downloaded XLS.
        rows = []
        for sheet in xlrd.open_workbook(workspace / MIRROR['filename']).sheets():
            if sheet.nrows < 2:
                continue
            headers = sheet.row_values(1)
            check(headers == RAW_COLUMNS, f'Unexpected headers in {sheet.name}')
            for index in range(2, sheet.nrows):
                values = [str(int(v)) if isinstance(v, float) and v.is_integer() else ('' if v is None else str(v)) for v in sheet.row_values(index)]
                if values[0]:
                    rows.append({'sheet': sheet.name, 'source_row': index + 1, 'raw': dict(zip(headers, values))})
    keys = set()
    source_locations = set()
    for row in rows:
        raw = row['raw']
        check(list(raw) == RAW_COLUMNS, 'Unexpected original 27-column schema/order')
        check(all(isinstance(raw[column], str) for column in RAW_COLUMNS), 'Non-string original field')
        check(re.fullmatch(r'[0-9]{6}', raw['部门代码']) is not None, 'Original department code must retain six digits')
        check(re.fullmatch(r'[0-9]{12}', raw['职位代码']) is not None, 'Original position code must retain twelve digits')
        check(re.fullmatch(r'[0-9]+', raw['招考人数']) is not None and int(raw['招考人数']) > 0, 'Invalid raw headcount')
        key = f"2027:{raw['部门代码']}:{raw['职位代码']}"
        location = (row['sheet'], row['source_row'])
        check(key not in keys, f'Duplicate original composite key {key}')
        check(isinstance(row['source_row'], int) and row['source_row'] >= 3, 'Source row must be a 1-based Excel data row')
        check(location not in source_locations, f'Duplicate workbook location {location}')
        keys.add(key)
        source_locations.add(location)
    check(len(rows) == 19_426, 'Original position count mismatch')
    check(sum(int(row['raw']['招考人数']) for row in rows) == 35_691, 'Original hire count mismatch')
    return rows


def make_records(raw_rows, csv_rows):
    annotations = {f"2027:{r['dept_code'].zfill(6)}:{r['position_code']}": r for r in csv_rows}
    records = []
    for source in raw_rows:
        raw = source['raw']
        pid = f"2027:{raw['部门代码']}:{raw['职位代码']}"
        annotation = annotations.pop(pid)
        check(int(annotation['headcount']) == int(raw['招考人数']), f'{pid}: CSV annotation join headcount mismatch')
        check(annotation['dept_name'] == raw['部门名称'], f'{pid}: CSV annotation join department-name mismatch')
        records.append([
            pid, 2027, source['sheet'], source['source_row'],
            annotation['work_province'], annotation['treatment_system_class'],
            *[raw[column] for column in RAW_COLUMNS],
        ])
    check(not annotations, 'Unmatched CSV annotation records')
    return records


def field_dictionary():
    descriptions = {
        'id': ('string', 'derived_from_original_codes', '2027:原始六位部门代码:原始十二位职位代码；职位代码单独不唯一。'),
        'year': ('integer', 'dataset_year', '招录年度。'),
        'source_sheet': ('string', 'original_workbook_location', '全国镜像原件的工作表名称。'),
        'source_row': ('integer', 'original_workbook_location', '原工作表 Excel 行号，从 1 开始；列名位于第 2 行。'),
        'source_csv_province': ('string', 'third_party_analysis_annotation', '第三方 CSV work_province；便于地区聚合，原文工作地点另存，不是原表独立省份字段。'),
        'source_system_tag': ('string', 'third_party_analysis_annotation', '第三方 CSV treatment_system_class；分析标签，不等同于官方机构性质或原 HTML 的 28 类系统。'),
    }
    fields = []
    for column in META_COLUMNS:
        kind, provenance, description = descriptions[column]
        fields.append({'name': column, 'type': kind, 'provenance': provenance, 'description': description})
    for column in RAW_COLUMNS:
        fields.append({
            'name': column, 'type': 'string', 'provenance': 'original_workbook_field',
            'source_column': column,
            'description': '原表字段原文；空单元格为 ""。' + ('用于统计时显式转换为正整数，存储仍保留源值字符串。' if column == '招考人数' else ''),
        })
    return fields


def write_shards(directory, records):
    directory.mkdir(parents=True, exist_ok=True)
    shards = []
    bucket = []
    bucket_bytes = 0

    def prefix(index):
        metadata = {'schema_version': '1.0.0', 'dataset_id': DATASET_ID, 'shard_index': index, 'columns': COLUMNS}
        return encode(metadata)[:-1] + b',"rows":['

    def flush():
        nonlocal bucket, bucket_bytes
        index = len(shards) + 1
        payload = prefix(index) + b',\n'.join(encoded for _, encoded in bucket) + b']}\n'
        check(len(payload) < 900_000, 'A position shard exceeds the UTF-8 byte cap')
        path = directory / f'positions-{index:03d}.json'
        path.write_bytes(payload)
        shards.append({
            'path': path.name, 'positions': len(bucket),
            'hires': sum(int(record[len(META_COLUMNS) + RAW_COLUMNS.index('招考人数')]) for record, _ in bucket),
            'bytes': len(payload), 'sha256': sha256(payload),
            'first_id': bucket[0][0][0], 'last_id': bucket[-1][0][0],
        })
        bucket = []
        bucket_bytes = 0

    for record in records:
        encoded = encode(record)
        projected = len(prefix(len(shards) + 1)) + bucket_bytes + len(encoded) + (2 if bucket else 0) + 3
        if bucket and projected > SHARD_LIMIT:
            flush()
        check(len(prefix(len(shards) + 1)) + len(encoded) + 3 <= SHARD_LIMIT, 'One record exceeds the shard limit')
        bucket_bytes += len(encoded) + (2 if bucket else 0)
        bucket.append((record, encoded))
    if bucket:
        flush()
    # Prove that compact columns+rows encoding has preserved every source value.
    reread = []
    for shard in shards:
        content = (directory / shard['path']).read_bytes()
        check(len(content) == shard['bytes'] and sha256(content) == shard['sha256'], 'Shard integrity failure')
        decoded = json.loads(content)
        check(decoded['columns'] == COLUMNS, 'Shard schema mismatch')
        check(len(decoded['rows']) == shard['positions'], 'Shard position count mismatch')
        reread.extend(decoded['rows'])
    check(reread == records, 'Source-to-shard round-trip changed a field or metadata value')
    return shards


def build_positions(project, raw_rows, csv_rows):
    directory = project / 'data' / 'positions_2027'
    records = make_records(raw_rows, csv_rows)
    shards = write_shards(directory, records)
    by_sheet = collections.defaultdict(lambda: {'positions': 0, 'hires': 0})
    for row in raw_rows:
        by_sheet[row['sheet']]['positions'] += 1
        by_sheet[row['sheet']]['hires'] += int(row['raw']['招考人数'])
    manifest = {
        'schema_version': '1.0.0', 'dataset_id': DATASET_ID, 'year': 2027,
        'format': 'Each shard repeats columns; each rows entry has one value per column in the same order.',
        'columns': COLUMNS, 'metadata_columns': META_COLUMNS, 'raw_columns': RAW_COLUMNS,
        'field_dictionary': field_dictionary(),
        'primary_key': {'format': 'year:department_code:position_code', 'example': records[0][0], 'original_code_widths': {'部门代码': 6, '职位代码': 12}, 'position_code_alone_is_unique': False},
        'totals': {'positions': len(records), 'hires': 35_691, 'raw_fields_per_position': len(RAW_COLUMNS), 'distinct_department_codes': len({r['raw']['部门代码'] for r in raw_rows}), 'source_csv_provinces': len({r[4] for r in records}), 'source_system_tags': len({r[5] for r in records})},
        'by_source_sheet': [{'source_sheet': sheet, **counts} for sheet, counts in by_sheet.items()],
        'sources': [MIRROR, OFFICIAL_NATIONAL, {**csv_source(2027), 'role': 'source_csv_province_and_source_system_tag_only'}, UPSTREAM_XLSX, SHANGHAI_OFFICIAL],
        'recorded_source_verification': RECORDED_VERIFICATION,
        'source_text_preservation': {
            'original_columns_retained': 27,
            'text_cells': '原字符串按源表保留，未 trim、改写、补全或从旧清洗字段反推。',
            'numeric_cells': '源表整数型数值转为等值十进制字符串；原字符串代码保留前导零。',
            'blank_cells': 'empty string',
            'row_order': 'original workbook sheet and row order',
            'trace': 'sources[0] URL + SHA-256 + source_sheet + source_row + 原字段列名',
        },
        'build_validation': {'unique_composite_ids': len(records), 'source_csv_join': 'one_to_one', 'source_to_shards_round_trip': 'all_27_original_fields_and_all_metadata_exactly_equal', 'shards_have_valid_sha256': True, 'each_shard_utf8_bytes_lt': 900_000},
        'shards': shards,
    }
    dump(directory / 'manifest.json', manifest, pretty=True)
    return {'positions': len(records), 'hires': 35_691, 'shards': len(shards), 'shard_bytes': sum(s['bytes'] for s in shards), 'max_shard_bytes': max(s['bytes'] for s in shards)}


def aggregate(rows, keys):
    counts = collections.defaultdict(lambda: [0, 0])
    for row in rows:
        key = tuple(row[field] for field in keys)
        counts[key][0] += 1
        counts[key][1] += row['hires']
    return [{**dict(zip(keys, key)), 'positions': value[0], 'hires': value[1]} for key, value in sorted(counts.items())]


def build_histories(project, raw_rows, csv_by_year):
    output_years = []
    groups = {
        'by_province': ['source_csv_province'],
        'by_department': ['department_code', 'department_name'],
        'by_education_raw': ['education_raw'],
        'by_org_level': ['org_level_raw'],
        'by_exam_category': ['exam_category_raw'],
    }
    raw_index = {f"2027:{r['raw']['部门代码']}:{r['raw']['职位代码']}": r['raw'] for r in raw_rows}
    for year, csv_rows in sorted(csv_by_year.items()):
        rows = []
        for source in csv_rows:
            pid = f"{year}:{source['dept_code'].zfill(6)}:{source['position_code']}"
            if year == 2027:
                raw = raw_index[pid]
                item = {'department_code': raw['部门代码'], 'department_name': raw['部门名称'], 'education_raw': raw['学历'], 'org_level_raw': raw['机构层级'], 'exam_category_raw': raw['考试类别'], 'hires': int(raw['招考人数'])}
            else:
                item = {'department_code': source['dept_code'].zfill(6), 'department_name': source['dept_name'], 'education_raw': source['education_raw'], 'org_level_raw': source['org_level'], 'exam_category_raw': source['exam_category'], 'hires': int(source['headcount'])}
            rows.append({'id': pid, 'source_csv_province': source['work_province'], **item})
        totals = {'positions': len(rows), 'hires': sum(r['hires'] for r in rows)}
        check((totals['positions'], totals['hires']) == CSV_SPECS[year][:2], f'{year}: history totals mismatch')
        check(len({row['id'] for row in rows}) == len(rows), f'{year}: history duplicate key')
        department_names = collections.defaultdict(set)
        for row in rows:
            department_names[row['department_code']].add(row['department_name'])
        check(all(len(names) == 1 for names in department_names.values()), f'{year}: department code/name ambiguity')
        grouped = {name: aggregate(rows, fields) for name, fields in groups.items()}
        for name, values in grouped.items():
            check(sum(r['positions'] for r in values) == totals['positions'] and sum(r['hires'] for r in values) == totals['hires'], f'{year}: {name} marginal totals mismatch')
        check(len(grouped['by_province']) == 31, f'{year}: expected 31 province annotations')
        output_years.append({
            'year': year,
            'field_source': 'national_2027_workbook_mirror' if year == 2027 else f'upstream_csv_{year}',
            'province_annotation_source': f'upstream_csv_{year}',
            'totals': totals, **grouped,
            'validation': {'unique_composite_ids': len(rows), 'province_groups': 31, 'department_groups': len(department_names), 'all_five_marginals_sum_to_national_totals': True},
        })
    result = {
        'schema_version': '1.0.0', 'dataset_id': 'national-civil-service-position-history-2024-2027',
        'metric_dictionary': {'positions': '职位记录数；同年度的部门代码与职位代码复合键唯一。', 'hires': '招考人数合计；属于计划名额，不是报名人数、竞争比或实际录用人数。'},
        'field_dictionary': {
            'source_csv_province': '各年度第三方清洗表 work_province 分析注记，31 个省级地区；不冒充源表独立省份字段。',
            'department_code': '2027 保留原始六位代码；2024–2026 从 CSV 部门代码左补零至六位，仅用于本年分组和复合键。',
            'department_name': '2027 为原表部门名称；历史为 CSV dept_name 原字符串。',
            'education_raw': '2027 为原表学历；历史为 CSV education_raw 原字符串，不转为最低学历等级。',
            'org_level_raw': '2027 为原表机构层级；历史为 CSV org_level 原字符串。',
            'exam_category_raw': '2027 为原表考试类别；历史为 CSV exam_category 原字符串。',
        },
        'comparability_notes': [
            '逐年统计该年招录计划职位和人数。各年复合键仅标识当年记录；不把相同代码自动视为跨年同一岗位。',
            '2024–2026 使用固定哈希的第三方清洗表；本次未对这三年逐条对照官方原件，分类原文未再标准化或合并。',
            '2027 除省份分析注记外，人数、部门、学历、层级和考试类别都来自全国镜像原表 27 字段。',
            '所有省份统计沿用第三方 work_province，源表可能使用更具体或不同范围的工作地点文字。',
            '每一种分类分别穷尽全年记录；不同分类之间不是联合分布，不能相乘推断交叉筛选结果。',
        ],
        'excluded_derived_fields': ['grassroots_years', 'extra_flags', 'age_min', 'age_max', 'min_service_years', 'treatment_region_key', 'treatment_region_tier', 'treatment_system_tier', 'treatment_score'],
        'sources': [MIRROR, *[csv_source(year) for year in sorted(csv_by_year)]],
        'years': output_years,
    }
    file_info = dump(project / 'data' / 'histories_2024_2027.json', result)
    reread = json.loads((project / 'data' / 'histories_2024_2027.json').read_bytes())
    check(reread == result, 'History output round-trip failure')
    return {**file_info, 'years': [{'year': row['year'], **row['totals'], **row['validation']} for row in output_years]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--workspace', type=Path, required=True)
    parser.add_argument('--project', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--mode', choices=['positions', 'histories', 'all'], default='all')
    args = parser.parse_args()
    raw_rows = read_raw(args.workspace)
    years = [2027] if args.mode == 'positions' else sorted(CSV_SPECS)
    csv_by_year = {year: read_csv(args.workspace, year) for year in years}
    summary = {}
    if args.mode in ['positions', 'all']:
        summary['positions_2027'] = build_positions(args.project, raw_rows, csv_by_year[2027])
    if args.mode in ['histories', 'all']:
        summary['histories_2024_2027'] = build_histories(args.project, raw_rows, csv_by_year)
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
