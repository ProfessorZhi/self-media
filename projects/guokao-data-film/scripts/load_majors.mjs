import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const defaultDirectory = fileURLToPath(new URL('../data/majors_2027/', import.meta.url));
const readJson = async (filename) => JSON.parse(await readFile(filename, 'utf8'));
const check = (condition, message) => {
  if (!condition) throw new Error(`Invalid major data: ${message}`);
};
const array = (value, label) => {
  check(Array.isArray(value), `${label} must be an array`);
  return value;
};
const identifier = (value, label) => {
  check(typeof value === 'string' && value.length > 0, `${label} must be a nonempty string`);
  return value;
};

async function readVerifiedShards(directory, descriptors, label, seenPaths) {
  const parts = array(descriptors, label).map((part, index) => {
    const context = `${label}[${index}]`;
    identifier(part.path, `${context}.path`);
    const filename = path.resolve(directory, part.path);
    check(!seenPaths.has(filename), `duplicate shard path: ${part.path}`);
    seenPaths.add(filename);
    check(Number.isSafeInteger(part.bytes) && part.bytes >= 0, `${context}.bytes must be a nonnegative integer`);
    check(Number.isSafeInteger(part.records) && part.records >= 0, `${context}.records must be a nonnegative integer`);
    check(typeof part.sha256 === 'string' && /^[a-f\d]{64}$/i.test(part.sha256), `${context}.sha256 must be a SHA-256 digest`);
    return {part, filename};
  });
  return (await Promise.all(parts.map(async ({part, filename}) => {
    const bytes = await readFile(filename);
    check(bytes.byteLength === part.bytes, `${part.path}: byte count ${bytes.byteLength}, expected ${part.bytes}`);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    check(sha256 === part.sha256.toLowerCase(), `${part.path}: SHA-256 mismatch`);
    const records = array(JSON.parse(bytes.toString('utf8')), part.path);
    check(records.length === part.records, `${part.path}: record count ${records.length}, expected ${part.records}`);
    return records;
  }))).flat();
}

/** Load source-text references. No function in this module decides eligibility. */
export async function loadMajorData(directory = defaultDirectory) {
  const manifest = await readJson(path.join(directory, 'manifest.json'));
  const shardPaths = new Set();
  const requirements = await readVerifiedShards(directory, manifest.requirements, 'requirements', shardPaths);
  const codeMentions = await readVerifiedShards(directory, manifest.code_mentions, 'code_mentions', shardPaths);
  const catalogs = await Promise.all(manifest.catalogs.map(p => readJson(path.join(directory, p))));
  const taxNameCrosswalk = await readJson(path.join(directory, manifest.tax_name_crosswalk));
  const requirementById = new Map();
  const requirementByPosition = new Map();
  for (const r of requirements) {
    identifier(r.id, 'requirement id');
    check(!requirementById.has(r.id), `duplicate requirement id: ${r.id}`);
    requirementById.set(r.id, r);
    const positionIds = array(r.position_ids, `${r.id}.position_ids`);
    check(Number.isSafeInteger(r.positions) && r.positions > 0 && r.positions === positionIds.length, `${r.id}: positions does not match position_ids`);
    for (const id of positionIds) {
      identifier(id, `${r.id} position id`);
      check(!requirementByPosition.has(id), `position appears more than once in requirements: ${id}`);
      requirementByPosition.set(id, r);
    }
  }
  const codeIndex = new Map();
  for (const r of codeMentions) {
    const code = identifier(r.code, 'literal code token').trim().toUpperCase();
    check(code.length > 0 && r.code === code, `code token is not in canonical uppercase form: ${r.code}`);
    check(!codeIndex.has(code), `duplicate literal code token: ${code}`);
    codeIndex.set(code, r);
    const positions = array(r.position_ids, `${code}.position_ids`);
    check(r.positions === positions.length && new Set(positions).size === positions.length, `${code}: duplicate or inconsistent position_ids`);
    for (const id of positions) check(requirementByPosition.has(id), `${code}: unknown position id ${id}`);
    for (const id of array(r.requirement_ids, `${code}.requirement_ids`)) {
      check(requirementById.has(id), `${code}: unknown requirement id ${id}`);
    }
  }
  if (manifest.summary) {
    check(requirements.length === manifest.summary.requirement_groups, 'requirement group count does not match manifest summary');
    check(requirementByPosition.size === manifest.summary.positions, 'position partition does not match manifest summary');
    check(codeIndex.size === manifest.summary.distinct_case_folded_literal_code_tokens, 'code token count does not match manifest summary');
  }
  const nodeIndex = new Map();
  for (const c of catalogs) {
    for (const field of ['gates', 'categories', 'majors', 'first_level_disciplines', 'professional_degree_categories']) {
      for (const n of c[field] ?? []) {
        identifier(n.id, `${c.catalog_id}.${field} node id`);
        check(!nodeIndex.has(n.id), `duplicate catalog node id: ${n.id}`);
        nodeIndex.set(n.id, {...n, catalog_id: c.catalog_id});
      }
    }
  }
  const validateReferences = (ids, label) => {
    for (const id of array(ids, label)) check(nodeIndex.has(id), `${label}: unknown catalog node id ${id}`);
  };
  for (const r of requirements) {
    validateReferences(r.catalog_candidate_ids, `${r.id}.catalog_candidate_ids`);
    for (const m of array(r.code_mentions, `${r.id}.code_mentions`)) {
      validateReferences(m.catalog_candidate_ids, `${r.id} code ${m.code}`);
      check(codeIndex.has(m.code), `${r.id}: unknown literal code token ${m.code}`);
    }
    for (const t of array(r.name_references, `${r.id}.name_references`)) {
      validateReferences(t.catalog_candidate_ids, `${r.id} name reference ${t.name_candidate}`);
    }
    const tokens = array(r.explicit_code_tokens, `${r.id}.explicit_code_tokens`);
    check(new Set(tokens).size === tokens.length, `${r.id}: duplicate explicit code token`);
    for (const token of tokens) check(codeIndex.has(token), `${r.id}: unknown literal code token ${token}`);
  }
  for (const r of codeMentions) {
    validateReferences(r.catalog_candidates_without_degree_scope, `${r.code}.catalog_candidates_without_degree_scope`);
  }
  for (const e of array(taxNameCrosswalk, 'taxNameCrosswalk')) {
    validateReferences([e.tax_category_id], 'tax crosswalk category');
    validateReferences(e.catalog_candidate_ids, `tax crosswalk member ${e.member_name}`);
  }
  for (const c of catalogs) {
    for (const edge of c.membership_edges ?? []) validateReferences([edge.category_id], `${c.catalog_id} membership category`);
  }
  const children = new Map();
  for (const n of nodeIndex.values()) {
    if (n.parent_id) {
      validateReferences([n.parent_id], `${n.id}.parent_id`);
      children.set(n.parent_id, [...(children.get(n.parent_id) ?? []), n.id]);
    }
  }
  const expansionCache = new Map();
  function expandReference(id) {
    if (expansionCache.has(id)) return expansionCache.get(id);
    const result = new Set([id]);
    const visit = (key) => {
      for (const child of children.get(key) ?? []) {
        if (!result.has(child)) { result.add(child); visit(child); }
      }
    };
    visit(id);
    if (id.startsWith('sat-recruitment:2027:')) {
      for (const edge of taxNameCrosswalk.filter(e => e.tax_category_id === id)) {
        for (const candidate of edge.catalog_candidate_ids) result.add(candidate);
      }
    }
    expansionCache.set(id, result);
    return result;
  }
  return {
    manifest, requirements, codeMentions, catalogs, taxNameCrosswalk,
    getRequirement: (positionId) => requirementByPosition.get(positionId) ?? null,
    findExplicitCode: (code) => codeIndex.get(String(code).trim().toUpperCase()) ?? null,
    getCatalogNode: (id) => nodeIndex.get(id) ?? null,
    expandReference: (id) => ({reference_id: id, catalog_candidate_ids: [...expandReference(id)], relation: 'catalog_membership_or_tax_exact_name_candidate', eligibility_evaluated: false}),
    /** Returns references including flagged conditions, not all eligible jobs. */
    findPositionReferences(catalogId, {includeCategoryMembership = false} = {}) {
      return requirements.filter(r => r.catalog_candidate_ids.some(id => id === catalogId || (includeCategoryMembership && expandReference(id).has(catalogId))))
        .map(r => ({requirement_id: r.id, position_ids: r.position_ids, positions: r.positions, hires: r.hires, review_reasons: r.review_reasons, relation: r.catalog_candidate_ids.includes(catalogId) ? 'direct_catalog_identity_candidate' : 'catalog_membership_candidate', eligibility_evaluated: false}));
    }
  };
}
