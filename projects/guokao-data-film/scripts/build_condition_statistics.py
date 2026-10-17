#!/usr/bin/env python3
"""Aggregate original job-condition columns; regex signals stay labeled signals."""
import argparse,collections,hashlib,json,re
from pathlib import Path
from build_position_foundation import read_raw

def build(workspace,out):
    rows=read_raw(workspace)
    fields=['学历','学位','政治面貌','基层工作最低年限','服务基层项目工作经历','是否在面试阶段组织专业能力测试','面试人员比例','职位属性','职位分布','机构层级','考试类别']
    aggregates={}
    for field in fields:
        groups=collections.defaultdict(lambda:[0,0])
        for x in rows:
            r=x['raw'];groups[r[field]][0]+=1;groups[r[field]][1]+=int(r['招考人数'])
        aggregates[field]=[{'raw_value':k,'positions':v[0],'hires':v[1]} for k,v in sorted(groups.items(),key=lambda x:(-x[1][1],x[0]))]
    signal_patterns={
        '2027届毕业生表述':r'2027\s*届',
        '应届毕业生表述':r'应届(?:高校)?毕业生',
        '明确限男性表述':r'限男性|仅限男性',
        '明确限女性表述':r'限女性|仅限女性',
        '适合男性表述':r'适合男性',
        '最低服务年限表述':r'最低服务年限',
        '大学英语四级表述':r'(?:英语.{0,8}(?:四级|4级)|CET[-—\s]?4)',
        '大学英语六级表述':r'(?:英语.{0,8}(?:六级|6级)|CET[-—\s]?6)',
        '法律职业资格表述':r'法律职业资格',
        '注册会计师表述':r'注册会计师',
        '户籍条件或说明表述':r'户籍',
        '夜间值班或轮班表述':r'夜班|夜间|倒班|轮班',
        '体能测评表述':r'体能测评',
        '不提供宿舍表述':r'不提供宿舍|无法提供宿舍',
        '提供宿舍表述（排除不提供）':r'(?<!不)(?<!无法)提供(?:集体)?宿舍'
    }
    signals=[]
    for label,pattern in signal_patterns.items():
        entries=[];hires=0
        for x in rows:
            r=x['raw'];text=r['备注'];m=re.search(pattern,text,re.I)
            if m:
                entries.append({'position_id':'2027:'+r['部门代码']+':'+r['职位代码'],'evidence':text[max(0,m.start()-18):min(len(text),m.end()+65)],'start':m.start(),'end':m.end()});hires+=int(r['招考人数'])
        signals.append({'label':label,'source_field':'备注','regex':pattern,'positions':len(entries),'hires':hires,'semantics':'literal_text_signal_not_complete_eligibility_condition','examples':entries[:5]})
    grids=[]
    for left,right in [('学历','政治面貌'),('学历','基层工作最低年限'),('学历','是否在面试阶段组织专业能力测试'),('机构层级','考试类别'),('职位属性','职位分布')]:
        g=collections.defaultdict(lambda:[0,0])
        for x in rows:
            r=x['raw'];g[(r[left],r[right])][0]+=1;g[(r[left],r[right])][1]+=int(r['招考人数'])
        grids.append({'dimensions':[left,right],'cells':[{'values':list(k),'positions':v[0],'hires':v[1]} for k,v in sorted(g.items())]})
    for group in aggregates.values():assert sum(r['positions'] for r in group)==19426 and sum(r['hires'] for r in group)==35691
    for grid in grids:assert sum(r['positions'] for r in grid['cells'])==19426 and sum(r['hires'] for r in grid['cells'])==35691
    out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps({'schema_version':'1.0.0','year':2027,'totals':{'positions':19426,'hires':35691},'source':'positions_2027/manifest.json','source_fields':'Original national workbook; no legacy derived flags/age/treatment scores.','by_raw_condition':aggregates,'joint_distributions':grids,'remarks_text_signals':signals,'notes':['Blank is distinct from the literal source value 无/无限制/不限.','Regex signals are selected text mentions; they neither prove that every restriction is captured nor replace the complete remarks.','Target interview ratios describe the plan, not the final number of interviewees.']},ensure_ascii=False,separators=(',',':'))+'\n')
    print(json.dumps({'groups':len(aggregates),'joint_distributions':len(grids),'signals':[{'label':x['label'],'positions':x['positions'],'hires':x['hires']} for x in signals]},ensure_ascii=False))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--workspace',type=Path,required=True);p.add_argument('--output',type=Path,default=Path(__file__).resolve().parents[1]/'data'/'position_conditions_2027.json');a=p.parse_args();build(a.workspace,a.output)
