// Verify repository artifacts without network or external dependencies.
// Run: node projects/guokao-data-film/scripts/verify_data.mjs
// Integrity checks do not establish official provenance or applicant eligibility.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function verifyResearch(read) {
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  let checks = 0;
  const eq = (actual, expected, label) => { checks++; assert(actual === expected, label + ": got " + actual + ", expected " + expected); };
  const sum = (rows, key) => rows.reduce((n, row) => n + row[key], 0);
  const round = (n, digits = 1) => Number(n.toFixed(digits));
  const unique = (rows, key, label) => eq(new Set(rows.map(key)).size, rows.length, label + " unique keys");
  const counts = (rows, expected, label, key = x => x.name) => {
    unique(rows, key, label);
    for (const row of rows) for (const metric of ["positions", "hires"]) {
      checks++; assert(Number.isSafeInteger(row[metric]) && row[metric] >= 0, label + " invalid " + metric);
    }
    for (const metric of ["positions", "hires"]) eq(sum(rows, metric), expected[metric], label + " " + metric);
  };
  const cellKey = x => x.province + "|" + x.source_system_tag;
  const marginal = (cells, dimension, expected, label) => {
    const actual = new Map();
    for (const c of cells) {
      const key = c[dimension], v = actual.get(key) || {positions: 0, hires: 0};
      v.positions += c.positions; v.hires += c.hires; actual.set(key, v);
    }
    eq(actual.size, expected.length, label + " category count");
    for (const row of expected) {
      checks++; assert(actual.has(row.name), label + " missing " + row.name);
      for (const m of ["positions", "hires"]) eq(actual.get(row.name)[m], row[m], label + " " + row.name + "/" + m);
    }
  };
  const d = read("data/2027_position_derived_aggregates.json"), t = d.totals;
  eq(t.positions, 19426, "national positions"); eq(t.hires, 35691, "national hires");
  eq(d.by_province.length, 31, "provinces");
  for (const field of ["by_province","by_agency_class","by_exam_category","by_org_level","by_education_raw","by_source_system_tag"]) counts(d[field], t, field);
  const cells = d.by_province_and_source_system_tag;
  counts(cells, t, "national cells", cellKey);
  marginal(cells, "province", d.by_province, "national province marginal");
  marginal(cells, "source_system_tag", d.by_source_system_tag, "national tag marginal");
  const parent = new Map(cells.map(c => [cellKey(c), c]));
  const mc = d.major_code_mentions;
  eq(mc.unique_codes, mc.codes.length, "raw token count"); eq(mc.unique_codes, 649, "snapshot raw tokens");
  eq(mc.coded_positions, 3252, "coded positions"); eq(mc.coded_positions + mc.uncoded_positions, t.positions, "coverage");
  unique(mc.codes, x => x.code, "raw tokens");
  for (const item of mc.codes) {
    const expected = {positions: item.explicit_mentions_positions, hires: item.explicit_mentions_hires};
    for (const field of ["by_province","by_source_system_tag","by_agency_class"]) counts(item[field], expected, item.code + "/" + field);
    const cc = item.by_province_and_source_system_tag;
    counts(cc, expected, item.code + "/cells", cellKey);
    marginal(cc, "province", item.by_province, item.code + "/province");
    marginal(cc, "source_system_tag", item.by_source_system_tag, item.code + "/tag");
    for (const c of cc) {
      const pc = parent.get(cellKey(c)); checks++; assert(pc, item.code + " unknown national cell");
      for (const m of ["positions","hires"]) { checks++; assert(c[m] <= pc[m], item.code + " exceeds parent " + m); }
    }
  }
  // Codes overlap. Do not sum different code nodes or infer their intersections.
  const legacy = read("data/observatory_2027_legacy_snapshot.json");
  eq(legacy.records.length, 28, "legacy categories");
  eq(sum(legacy.records, "jobs"), t.positions, "legacy positions"); eq(sum(legacy.records, "hires"), t.hires, "legacy hires");
  const history = read("data/annual_recruitment_2024_2027_secondary.json");
  const y26 = history.years.find(x => x.year === 2026), y27 = history.years.find(x => x.year === 2027);
  assert(y26 && y27, "missing history years");
  eq(y27.hires, t.hires, "history current hires"); eq(y27.positions, t.positions, "history current positions");
  eq(y27.hires - y26.hires, history.y2027_vs_y2026.hires_change, "history hires delta");
  eq(y27.positions - y26.positions, history.y2027_vs_y2026.positions_change, "history positions delta");
  eq(round((y27.hires-y26.hires)/y26.hires*100,2), history.y2027_vs_y2026.hires_pct_change, "history hires percentage");
  const snapshot = read("data/2027_registration_snapshot_20261016_secondary.json");
  eq(snapshot.by_province.length, 31, "registration provinces");
  for (const key of ["applicants","qualified"]) eq(sum(snapshot.by_province,key), snapshot.totals[key], "registration " + key);
  const timetable = read("data/official_2027_exam_timeline.json");
  for (const e of timetable.events) {
    checks++; assert(Number.isFinite(Date.parse(e.start)), "invalid event start " + e.id);
    if (e.end) { checks++; assert(Number.isFinite(Date.parse(e.end)) && Date.parse(e.end) >= Date.parse(e.start), "invalid event end " + e.id); }
  }
  eq(timetable.events.find(x=>x.id==="registration_verify").start, "2026-10-14T08:00:00+08:00", "authentication starts");
  eq(timetable.events.find(x=>x.id==="apply").start, "2026-10-15T08:00:00+08:00", "application starts");
  const nia = read("data/official_2027_immigration_plan.json");
  eq(nia.units.length, 29, "NIA units"); unique(nia.units,x=>x.id,"NIA unit IDs");
  eq(sum(nia.units,"hires"),nia.totals.hires,"NIA summed hires"); eq(nia.totals.hires,1089,"NIA official total");
  unique(nia.units,x=>x.official_job_table_url,"NIA attachments");
  for (const group of nia.groups) {
    const rows=nia.units.filter(x=>x.group===group.group);
    eq(rows.length,group.units,"NIA group units"); eq(sum(rows,"hires"),group.hires,"NIA group hires");
  }
  eq(sum(nia.groups,"hires"),nia.totals.hires,"NIA group partition");
  eq(nia.groups.find(x=>x.group==="border_inspection_station").hires,legacy.records.find(x=>x.id==="border").hires,"NIA border legacy reconciliation");
  eq(nia.totals.hires-1020,legacy.records.find(x=>x.id==="migration").hires,"NIA other legacy reconciliation");
  const audit=read("data/major_code_namespace_audit_2027.json");
  eq(audit.coverage.extracted_distinct_tokens,mc.unique_codes,"audit token count");
  eq(audit.coverage.extraction_coverage_pct,round(mc.coded_positions/t.positions*100,2),"audit extraction coverage");
  eq(mc.validated_unique_major_count,null,"validated major count remains unknown");
  eq(mc.repaired_from_raw_in_this_revision,false,"raw repair not falsely claimed");
  for (const item of [...audit.confirmed_namespace_collisions,...audit.suffix_truncation.examples,...audit.code_distinctions]) {
    const code=mc.codes.find(x=>x.code===item.raw_code_token); assert(code,"missing audited token");
    eq(code.explicit_mentions_positions,item.positions,"audited token positions");
    eq(code.explicit_mentions_hires,item.hires,"audited token hires");
    eq(JSON.stringify(code.name_hints),JSON.stringify(item.name_hints),"audited name hints");
  }
  eq(mc.codes.filter(x=>x.code.endsWith("TK")).length,audit.suffix_truncation.tokens_ending_TK,"observed TK count");
  const hero=read("data/m1_hero_scene_2027.json");
  counts(hero.cells,t,"hero cells",cellKey); eq(hero.cells.length,cells.length,"hero cell count");
  for (const c of hero.cells) {
    const original=parent.get(cellKey(c)); assert(original,"unknown hero cell");
    eq(c.id,cellKey(c),"hero stable key");
    for (const m of ["positions","hires"]) eq(c[m],original[m],"hero exact source projection/"+m);
  }
  for (const b of hero.beats) {
    const selected=hero.cells.filter(c=>!b.filter||(b.filter.source_system_tag?c.source_system_tag===b.filter.source_system_tag:c.source_system_tag!==b.filter.exclude_source_system_tag));
    for (const m of ["positions","hires"]) eq(sum(selected,m),b[m],"hero beat "+b.id+"/"+m);
    eq(round(b.hires/b.denominator_hires*100),b.share_pct,"hero beat percentage "+b.id);
  }
  eq(hero.particle_contract.official_position_id,false,"hero is aggregate illustration");
  const challenge=read("content/knowledge_challenge_2027.json");
  eq(challenge.total_cards,challenge.cards.length,"card count"); unique(challenge.cards,x=>x.id,"card IDs");
  const tax=d.by_source_system_tag.find(x=>x.name==="tax"),law=mc.codes.find(x=>x.code==="030101K");
  const taxHistory=history.selected_system_comparison_2026_2027.find(x=>x.name==="税务系统");
  eq(taxHistory.hires_2027,tax.hires,"tax current history agrees");
  const expected={
    tax_share:round(tax.hires/t.hires*100), without_tax:t.hires-tax.hires,
    province_rank:Math.max(...d.by_province.filter(x=>["广东","山东","云南"].includes(x.name)).map(x=>x.hires)),
    grassroots_share:round(d.by_org_level.find(x=>x.name==="县（区）级及以下").hires/t.hires*100),
    major_code_mentions:law.explicit_mentions_positions, yoy_2027:y27.hires-y26.hires,
    immigration_scope:nia.totals.hires, register_vs_apply:"registration_verify",
    same_code_different_catalog:"depends_on_catalog",
    tax_count_down_share_up:round((taxHistory.hires_2027/y27.hires-taxHistory.hires_2026/y26.hires)*100,2)
  };
  eq(Object.keys(expected).length,challenge.cards.length,"all cards have explicit validation");
  const collision=audit.confirmed_namespace_collisions.find(x=>x.raw_code_token==="0809");
  eq(new Set(collision.catalog_meanings.map(x=>x.name)).size,2,"0809 two catalog meanings");
  for (const card of challenge.cards) {
    unique(card.options,x=>x.id,card.id+" options");
    const choice=card.options.find(x=>x.id===card.correct_option); assert(choice,"invalid correct option "+card.id);
    const value=Object.hasOwn(card.answer,"numeric")?card.answer.numeric:card.answer.value;
    eq(value,expected[card.id],"answer "+card.id);
    if (typeof value==="number") {
      const numeric=card.options.filter(x=>typeof x.value==="number");
      const distances=numeric.map(x=>Math.abs(x.value-value));
      const best=Math.min(...distances);
      eq(numeric.filter(x=>Math.abs(x.value-value)===best).length,1,"unambiguous numeric choice "+card.id);
      eq(Math.abs(choice.value-value),best,"correct numeric choice "+card.id);
    } else eq(choice.value,value,"correct text choice "+card.id);
  }
  return {integrity_verified:true,checks,positions:t.positions,hires:t.hires,national_cells:cells.length,raw_code_tokens:mc.codes.length,valid_semantic_majors:null,official_nia_units:nia.units.length,official_nia_hires:nia.totals.hires,content_cards:challenge.cards.length,official_workbook_row_validation:false,raw_major_parser_repaired:false,render_verified:false};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const read = relative => JSON.parse(fs.readFileSync(path.join(projectRoot, relative), 'utf8'));
  console.log(JSON.stringify(verifyResearch(read), null, 2));
}
