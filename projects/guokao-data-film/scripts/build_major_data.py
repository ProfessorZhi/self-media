#!/usr/bin/env python3
"""Build traceable major references, not an applicant eligibility engine.

Usage: python build_major_data.py --workspace /path/to/source/workspace
Inputs: pinned national XLS (optional audited raw_positions_extracted.json cache).
Catalog JSONs come from the workspace when present, otherwise this repository.
No network access. Output is deterministic; source text is never overwritten.
"""
import argparse, collections, hashlib, json, re
from pathlib import Path
from build_position_foundation import read_raw

TOKEN = re.compile(r'(?<![A-Za-z0-9])([0-9]{4,7}[A-Za-z0-9]*)(?![A-Za-z0-9])')
DEGREE_MARKER = re.compile(r'(大学本科|博士研究生|硕士研究生|研究生|本科|硕士|博士|大专|专科)(?:(?:阶段|学历|专业|学位|生)?\s*[：:]|(?:阶段|专业|生)?\s*(?:限定于|限定|限于|限|须为|应为|需为|为|招收)\s*[：:]?|(?:阶段|学历)?专业报考\s*[：:])')
DEGREE_WORD = re.compile(r'大学本科|博士研究生|硕士研究生|研究生|本科|硕士|博士|大专|专科')
NEGATIVE = re.compile(r'不含|不包括|不包含|除|不得|不接受|不招')
QUALIFIER = re.compile(r'方向|仅限|限于|限.{0,6}专业|相关|相近|同时|均[为须需]|须为|应为|需为|本科.{0,5}研究生|等专业|等相关|语种|所有阶段|各阶段')
UNRESTRICTED = re.compile(r'^(专业)?(不限|无限制|不限专业|不限制专业|专业不限)[。；;\s]*$')
CATALOG_FILES = ['major_bachelor_2026_official_parsed.json','major_graduate_2022_official_parsed.json','major_tax_2027_official_parsed.json']

def dump(path,obj):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(obj,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')

def digest(obj):
    return hashlib.sha256(json.dumps(obj,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()

def expected_scopes(education):
    scopes=[]
    if '本科' in education:scopes.append('bachelor')
    if '研究生' in education or education=='本科及以上' or education=='大专及以上':scopes.append('graduate')
    if '大专' in education or '专科' in education:scopes.append('associate')
    if education=='大专及以上' and 'bachelor' not in scopes:scopes.append('bachelor')
    return scopes or ['unknown']

def degree_scope(label):
    if label in ['本科','大学本科']:return 'bachelor'
    if label in ['大专','专科']:return 'associate'
    return 'graduate'

def clauses(raw,education):
    markers=list(DEGREE_MARKER.finditer(raw));out=[]
    if not markers:
        return [{'start':0,'end':len(raw),'text':raw,'degree_label':None,'education_scopes':expected_scopes(education),'scope_basis':'education_column_candidates'}]
    if markers[0].start()>0 and raw[:markers[0].start()].strip(' ,，;；\n'):
        prefix=raw[:markers[0].start()]
        label='本科' if re.search(r'本科专业不限',prefix) else None
        out.append({'start':0,'end':markers[0].start(),'text':prefix,'degree_label':label,'education_scopes':[degree_scope(label)] if label else expected_scopes(education),'scope_basis':'explicit_local_unrestricted' if label else 'unscoped_prefix'})
    for i,m in enumerate(markers):
        end=markers[i+1].start() if i+1<len(markers) else len(raw)
        out.append({'start':m.end(),'end':end,'text':raw[m.end():end],'degree_label':m.group(1),'education_scopes':[degree_scope(m.group(1))],'scope_basis':'explicit_degree_marker'})
    return out

def split_terms(text,compound_names):
    # Match exact known compound names before splitting. Parenthetical commas
    # are retained so negative clauses and specialization restrictions survive.
    protected={}
    cooked=text
    for name in compound_names:
        if name in cooked:
            key='\ue000'+str(len(protected))+'\ue001';protected[key]=name;cooked=cooked.replace(name,key)
    out=[];start=0;depth=0
    for i,c in enumerate(cooked):
        if c in '（([【':depth+=1
        elif c in '）)]】':depth=max(0,depth-1)
        if depth==0 and c in '、,，;；\n':
            out.append(cooked[start:i]);start=i+1
    out.append(cooked[start:])
    return [re.sub(r'\ue000\d+\ue001',lambda m:protected[m.group()],s).strip() for s in out if s.strip()]

def candidate_label(term):
    label=re.sub(r'^\s*(学科门类|专业类|一级学科|专业学位类别|专业)\s*[：:]\s*','',term)
    label=TOKEN.sub('',label)
    qualifier=None
    for p in ['（','(','[','【']:
        if p in label:
            qualifier=label[label.index(p):];label=label[:label.index(p)];break
    label=label.strip(' ：:()（）[]、,，;；。\n\t')
    if qualifier and not re.sub(r'[\s（）()\[\]【】、,，;；：:。]+','',qualifier):qualifier=None
    return label,qualifier

def build(workspace,output):
    source=read_raw(workspace)
    catalog_root=Path(__file__).resolve().parents[1]/'data'/'catalogs'
    catalogs=[json.loads((workspace/p if (workspace/p).exists() else catalog_root/p).read_text()) for p in CATALOG_FILES]
    bachelor,graduate,tax=catalogs
    nodes=[]
    for field in ['gates','categories','majors']:
        for n in bachelor[field]:nodes.append({**n,'namespace':bachelor['catalog_id'],'education_scope':'bachelor'})
    for field in ['gates','first_level_disciplines','professional_degree_categories']:
        for n in graduate[field]:nodes.append({**n,'namespace':graduate['catalog_id'],'education_scope':'graduate'})
    by_code=collections.defaultdict(list);by_name=collections.defaultdict(list);by_id={}
    for n in nodes:
        by_id[n['id']]=n;by_code[n['code']].append(n);by_name[n['name']].append(n)
    tax_by_name={n['category_name']:n for n in tax['categories']}
    compound_names=sorted([n for n in by_name if re.search('[、,，;；]',n)]+[e['member_name'] for e in tax['membership_edges'] if re.search('[、,，;；]',e['member_name'])],key=len,reverse=True)
    req_groups=collections.defaultdict(list)
    pos={}
    for item in source:
        r=item['raw'];pid='2027:'+r['部门代码']+':'+r['职位代码'];pos[pid]=r
        req_groups[(r['专业'],r['学历'],'tax' if '税务' in r['部门名称'] else 'general')].append(pid)
    requirements=[]
    lexical=collections.defaultdict(lambda:{'position_ids':set(),'raw_variants':set(),'requirement_ids':set()})
    code_resolution=collections.Counter();term_stats=collections.Counter()
    for (raw,education,agency_scope),pids in sorted(req_groups.items()):
        rid='req:'+digest([raw,education,agency_scope])[:16]
        cs=clauses(raw,education);mentions=[];terms=[]
        flags=[]
        if NEGATIVE.search(raw):flags.append('negative_condition_present')
        if QUALIFIER.search(raw) and not UNRESTRICTED.fullmatch(raw.strip()):flags.append('qualifier_or_open_scope_present')
        if len(cs)>1:flags.append('multiple_degree_clauses')
        if '本科专业不限' in raw:flags.append('local_unrestricted_is_not_global')
        for ci,c in enumerate(cs):
            c['id']=ci
            c['local_unrestricted']=bool(UNRESTRICTED.fullmatch(c['text'].strip(' ,，;；\n')) or re.fullmatch(r'本科专业不限[，,;；\s]*',c['text']))
            c['unresolved_degree_context']=bool(DEGREE_WORD.search(c['text']) and c['scope_basis']!='explicit_local_unrestricted')
            if c['unresolved_degree_context']:
                # A degree word left inside a clause can change which catalog
                # its codes belong to. Preserve it and avoid a global guess.
                c['education_scopes']=[]
                flags.append('unresolved_degree_context')
            c['contains_negative_condition']=bool(NEGATIVE.search(c['text']))
            c['contains_qualifier_or_open_scope']=bool(QUALIFIER.search(c['text']) and not c['local_unrestricted'])
            c['catalog_level_hint']='discipline_group' if re.match(r'^\s*学科门类\s*[：:]',c['text']) else None
            for match in TOKEN.finditer(c['text']):
                rawcode=match.group(1);code=rawcode.upper()
                candidates=[n for n in by_code.get(code,[]) if n['education_scope'] in c['education_scopes'] and (not c['catalog_level_hint'] or n['level']==c['catalog_level_hint'])]
                # Only context-resolved catalog identity, never inferred eligibility.
                status='catalog_identity_candidate' if len(candidates)==1 else ('ambiguous_catalog_namespace' if candidates else 'unresolved_in_loaded_catalogs')
                mentions.append({'code_raw':rawcode,'code':code,'clause_id':ci,'start':c['start']+match.start(),'end':c['start']+match.end(),'catalog_candidate_ids':[n['id'] for n in candidates],'resolution_status':status,'condition_requires_review':c['contains_negative_condition'] or c['contains_qualifier_or_open_scope']})
                code_resolution[status]+=len(pids)
                entry=lexical[code];entry['position_ids'].update(pids);entry['raw_variants'].add(rawcode);entry['requirement_ids'].add(rid)
            for term in split_terms(c['text'],compound_names):
                label,qualifier=candidate_label(term)
                term_codes={m.group(1).upper() for m in TOKEN.finditer(term)}
                # Stripping a generic final 专业 is allowed only for a dictionary match.
                if label not in by_name and label not in tax_by_name and label.endswith('专业'):
                    stripped=label[:-2]
                    if stripped in by_name or stripped in tax_by_name:label=stripped
                ids=[];kind=None
                if agency_scope=='tax' and label in tax_by_name and not term_codes:
                    ids=[tax_by_name[label]['id']];kind='tax_category_exact_name'
                else:
                    # A named code is more specific than its bare homonym.
                    # E.g. 0301法学 must not add the broader 03法学 gate.
                    candidates=[n for n in by_name.get(label,[]) if n['education_scope'] in c['education_scopes'] and (not c['catalog_level_hint'] or n['level']==c['catalog_level_hint']) and (not term_codes or n['code'].upper() in term_codes)]
                    if candidates:ids=[n['id'] for n in candidates];kind='catalog_exact_name'
                if len(ids)>1:flags.append('multiple_catalog_name_candidates')
                if not ids and TOKEN.search(term):kind='explicit_code_only_or_qualified_name'
                if not kind:kind='unresolved_text'
                requires_review=bool(qualifier or NEGATIVE.search(term) or (QUALIFIER.search(term) and not UNRESTRICTED.fullmatch(term.strip())) or c['contains_negative_condition'])
                terms.append({'clause_id':ci,'text':term,'name_candidate':label,'qualifier_raw':qualifier,'reference_kind':kind,'catalog_candidate_ids':ids,'condition_requires_review':requires_review})
                term_stats[kind]+=len(pids)
            if any(t['clause_id']==ci and t['qualifier_raw'] for t in terms):
                flags.append('parenthetical_scope_requires_review')
                c['contains_qualifier_or_open_scope']=True
                for m in mentions:
                    if m['clause_id']==ci:m['condition_requires_review']=True
        if any(m['resolution_status']=='unresolved_in_loaded_catalogs' for m in mentions):flags.append('code_not_in_loaded_catalogs')
        if any(m['resolution_status']=='ambiguous_catalog_namespace' for m in mentions):flags.append('ambiguous_catalog_namespace')
        if any(t['reference_kind']=='unresolved_text' for t in terms) and not UNRESTRICTED.fullmatch(raw.strip()):flags.append('unresolved_name_or_expression')
        direct_ids=sorted({x for m in mentions for x in m['catalog_candidate_ids']}|{x for t in terms for x in t['catalog_candidate_ids']})
        all_codes=sorted({m['code'] for m in mentions})
        req={'id':rid,'major_raw':raw,'education_raw':education,'agency_catalog_scope':agency_scope,'position_ids':sorted(pids),'positions':len(pids),'hires':sum(int(pos[p]['招考人数']) for p in pids),'clauses':cs,'explicit_code_tokens':all_codes,'code_mentions':mentions,'name_references':terms,'catalog_candidate_ids':direct_ids,'global_unrestricted_explicit':bool(UNRESTRICTED.fullmatch(raw.strip())),'review_reasons':sorted(set(flags)),'eligibility_evaluated':False}
        requirements.append(req)
    # Catalog-name links for tax members preserve the independent tax namespace.
    crosswalk=[]
    for e in tax['membership_edges']:
        candidates=[n for n in by_name.get(e['member_name'],[]) if n['level'] not in ['major_category','discipline_group']]
        crosswalk.append({'tax_category_id':e['category_id'],'member_index':e['member_index'],'member_name':e['member_name'],'member_label_raw':e['member_label_raw'],'qualifier_raw':e['qualifier_raw'],'catalog_candidate_ids':[n['id'] for n in candidates],'relation':'exact_name_candidate_only','education_scope_in_tax_source':None,'eligibility_evaluated':False})
    code_stats=[]
    for code,v in sorted(lexical.items()):
        pids=sorted(v['position_ids'])
        code_stats.append({'code':code,'raw_variants':sorted(v['raw_variants']),'positions':len(pids),'hires':sum(int(pos[p]['招考人数']) for p in pids),'position_ids':pids,'requirement_ids':sorted(v['requirement_ids']),'catalog_candidates_without_degree_scope':[n['id'] for n in by_code.get(code,[])],'semantics':'literal_token_in_major_raw_including_qualified_or_negative_contexts'})
    output.mkdir(parents=True,exist_ok=True)
    def shards(name,records,limit=820000):
        parts=[];bucket=[];size=0
        for rec in records:
            n=len(json.dumps(rec,ensure_ascii=False,separators=(',',':')).encode())+2
            if bucket and size+n>limit:
                p=output/(name+'-'+str(len(parts)+1).zfill(2)+'.json');dump(p,bucket);parts.append({'path':p.name,'records':len(bucket),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()});bucket=[];size=0
            bucket.append(rec);size+=n
        if bucket:
            p=output/(name+'-'+str(len(parts)+1).zfill(2)+'.json');dump(p,bucket);parts.append({'path':p.name,'records':len(bucket),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
        return parts
    req_parts=shards('requirements',requirements);code_parts=shards('code-mentions',code_stats)
    coded_pids={p for v in lexical.values() for p in v['position_ids']}
    referenced_pids={p for req in requirements if req['catalog_candidate_ids'] for p in req['position_ids']}
    review_pids={p for req in requirements if req['review_reasons'] for p in req['position_ids']}
    unrestricted={p for req in requirements if req['global_unrestricted_explicit'] for p in req['position_ids']}
    summary={'positions':len(source),'hires':sum(int(r['raw']['招考人数']) for r in source),'distinct_major_raw_strings':len({r['raw']['专业'] for r in source}),'requirement_groups':len(requirements),'distinct_case_folded_literal_code_tokens':len(lexical),'positions_with_explicit_code_tokens':len(coded_pids),'hires_with_explicit_code_tokens':sum(int(pos[p]['招考人数']) for p in coded_pids),'positions_without_explicit_code_tokens':len(source)-len(coded_pids),'positions_with_at_least_one_catalog_reference_candidate':len(referenced_pids),'positions_without_catalog_reference_candidate':len(source)-len(referenced_pids),'positions_with_review_reasons':len(review_pids),'positions_globally_unrestricted_in_major_column':len(unrestricted),'hires_globally_unrestricted_in_major_column':sum(int(pos[p]['招考人数']) for p in unrestricted),'code_resolution_occurrences_weighted_by_positions':dict(code_resolution),'name_reference_occurrences_weighted_by_positions':dict(term_stats),'applicant_eligibility_evaluated':False,'all_position_major_texts_preserved':True}
    manifest={'schema_version':'2.0.0','as_of':'2026-10-17','purpose':'Traceable per-position professional requirements and catalog references for Opus','summary':summary,'source_field':'2027 national workbook 专业, with 学历 for scope candidates','source_file':'../positions_2027/manifest.json','requirements':req_parts,'code_mentions':code_parts,'catalogs':['../catalogs/'+p for p in CATALOG_FILES],'tax_name_crosswalk':'tax-catalog-name-crosswalk.json','semantics':{'literal_code_counts':'Each position counted once per complete token; tokens are not unique semantic majors. Negative/qualified contexts are included and flagged.','catalog_references':'Exact code or exact name in a compatible education namespace. A candidate does not establish degree-code equivalence, full clause interpretation or application eligibility.','unresolved':'Graduate secondary/self-defined codes, agency categories, restrictions and unparsed expressions remain visible.','tax_membership':'Use official tax category membership; the separate exact-name crosswalk is only a candidate catalog identity link.','additivity':'A position can mention several codes. Never sum code/category counts to get national totals.'},'token_regex':TOKEN.pattern,'offset_unit':'Unicode code points (Python string offsets)','builder':'../../scripts/build_major_data.py'}
    dump(output/'manifest.json',manifest);dump(output/'tax-catalog-name-crosswalk.json',crosswalk)
    for fname,cat in zip(CATALOG_FILES,catalogs):dump(output.parent/'catalogs'/fname,cat)
    # Independent row-token check is deliberately different from clause processing.
    independent=collections.defaultdict(set)
    for pid,r in pos.items():
        for code in set(m.group(1).upper() for m in TOKEN.finditer(r['专业'])):independent[code].add(pid)
    assert set(independent)==set(lexical)
    assert all(independent[k]==v['position_ids'] for k,v in lexical.items())
    assert len({p for req in requirements for p in req['position_ids']})==len(pos)
    assert sum(req['positions'] for req in requirements)==len(pos)
    assert all(req['major_raw'][m['start']:m['end']]==m['code_raw'] for req in requirements for m in req['code_mentions'])
    assert all(m['catalog_candidate_ids'] or m['resolution_status']=='unresolved_in_loaded_catalogs' for req in requirements for m in req['code_mentions'])
    assert len(pos)==19426 and sum(int(r['招考人数']) for r in pos.values())==35691
    law=next(x for x in code_stats if x['code']=='030101K')
    assert (law['positions'],law['hires'])==(329,399)
    # Real source expressions that previously caused false broadening.
    by_requirement={r['id']:r for r in requirements}
    degree_case=by_requirement['req:ec283f564fee915f']
    for code in ['0712','0809']:
        ids={n for m in degree_case['code_mentions'] if m['code']==code for n in m['catalog_candidate_ids']}
        assert ids=={'moe-bachelor:2026:'+code}
    graduate_case=by_requirement['req:cdaef8854ebb25aa']
    assert all('moe-bachelor:2026:0812' not in m['catalog_candidate_ids'] for m in graduate_case['code_mentions'] if m['code']=='0812')
    assert by_requirement['req:eb1057cabab72ce7']['global_unrestricted_explicit']
    gate_case=by_requirement['req:4ef5d151e42cd139']
    assert all(n.rsplit(':',1)[-1] in ['02','03','04','07','08'] for n in gate_case['catalog_candidate_ids'])
    qualified_case=by_requirement['req:4549651b7a31aa92']
    assert 'parenthetical_scope_requires_review' in qualified_case['review_reasons']
    assert 'moe-graduate:2022:03' not in qualified_case['catalog_candidate_ids']
    for rid in ['req:71fff4ad4120cf69','req:a85029ac23cccb0d']:
        assert 'negative_condition_present' in by_requirement[rid]['review_reasons']
    local_case=next(r for r in requirements if '2027:132106:300147196001' in r['position_ids'])
    assert not local_case['global_unrestricted_explicit'] and any(c['local_unrestricted'] for c in local_case['clauses'])
    summary['validation']={'row_partition_complete':True,'independent_literal_token_extraction_agrees':True,'source_span_roundtrip':True,'real_expression_regressions':8,'law_030101K':{'positions':law['positions'],'hires':law['hires']}}
    dump(output/'validation.json',summary)
    print(json.dumps(summary,ensure_ascii=False,indent=2))

if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--workspace',type=Path,required=True);ap.add_argument('--output',type=Path,default=Path(__file__).resolve().parents[1]/'data'/'majors_2027');args=ap.parse_args();build(args.workspace,args.output)
