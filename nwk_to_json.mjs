/**
 * nwk_to_json.mjs
 *
 * Converts a Newick (.nwk) phylogenetic tree file into the JSON format
 * used by the Neighborhood-Preserving Voronoi Treemaps application.
 *
 * Usage:
 *   node nwk_to_json.mjs <input.nwk> <output.json> [Tree Display Name]
 *
 * Examples:
 *   node nwk_to_json.mjs "ray-finned fishes_order.nwk" src/data/ray_finned_fishes.json "Ray-finned Fishes"
 *   node nwk_to_json.mjs Actinopterygii_orders.nwk src/data/actinopterygii_orders.json "Actinopterygii Orders"
 *
 * Output schema mirrors the other files in src/data/:
 *   - Root object with id, name, useInternalEmbeddings, initializeWithPrecomputedPositions,
 *     weightAttribute, centroid, children
 *   - Internal nodes: { id, name?, branchLength?, children }
 *   - Leaf nodes:     { id, name, weight: 1, branchLength?, embeddings: <one-hot N-dim> }
 *
 * With useInternalEmbeddings:true the visualisation averages child embeddings upward,
 * so phylogenetically close leaves end up with similar effective embeddings.
 */

import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

// ── Newick parser ─────────────────────────────────────────────────────────────

let _internalCounter = 0;
function nextInternalId() { return `internal_${++_internalCounter}`; }

function parseNewick(s) {
  s = s.trim().replace(/;$/, '').trim();
  const pos = { i: 0 };
  return parseNode(s, pos);
}

function parseNode(s, pos) {
  if (s[pos.i] === '(') {
    // ── internal node ────────────────────────────────────────────────────────
    pos.i++; // skip '('
    const children = [];
    while (pos.i < s.length) {
      children.push(parseNode(s, pos));
      if (s[pos.i] === ',') { pos.i++; continue; }
      if (s[pos.i] === ')') { pos.i++; break; }
    }
    // optional node label (may be single-quoted or unquoted)
    let label = '';
    if (s[pos.i] === "'") {
      pos.i++;
      while (pos.i < s.length && s[pos.i] !== "'") label += s[pos.i++];
      pos.i++; // skip closing quote
    } else {
      while (pos.i < s.length && !':,);'.includes(s[pos.i])) label += s[pos.i++];
    }
    // optional branch length
    let branchLength = null;
    if (s[pos.i] === ':') {
      pos.i++;
      let bl = '';
      while (pos.i < s.length && !',);'.includes(s[pos.i])) bl += s[pos.i++];
      branchLength = parseFloat(bl);
    }
    const id = label || nextInternalId();
    const node = { id, children };
    if (label) node.name = label;
    if (branchLength !== null) node.branchLength = branchLength;
    return node;

  } else {
    // ── leaf node ─────────────────────────────────────────────────────────────
    let name = '';
    while (pos.i < s.length && !':,);'.includes(s[pos.i])) name += s[pos.i++];
    let branchLength = null;
    if (s[pos.i] === ':') {
      pos.i++;
      let bl = '';
      while (pos.i < s.length && !',);'.includes(s[pos.i])) bl += s[pos.i++];
      branchLength = parseFloat(bl);
    }
    const node = { id: name, name, weight: 1 };
    if (branchLength !== null) node.branchLength = branchLength;
    return node;
  }
}

// ── Collect ordered list of leaf nodes ───────────────────────────────────────

function collectLeaves(node, out = []) {
  if (!node.children) { out.push(node); return out; }
  for (const c of node.children) collectLeaves(c, out);
  return out;
}

// ── Assign one-hot embeddings to leaves ──────────────────────────────────────

function assignEmbeddings(node, leafIndex, n) {
  if (!node.children) {
    const emb = new Array(n).fill(0);
    emb[leafIndex[node.id]] = 1;
    node.embeddings = emb;
    return;
  }
  for (const c of node.children) assignEmbeddings(c, leafIndex, n);
}

// ── Main ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node nwk_to_json.mjs <input.nwk> <output.json> [Display Name]');
  process.exit(1);
}

const [inputArg, outputArg, displayName] = args;
const inputPath  = path.resolve(process.cwd(), inputArg);
const outputPath = path.resolve(process.cwd(), outputArg);

const nwk = readFileSync(inputPath, 'utf8');
const tree = parseNewick(nwk);

const leaves = collectLeaves(tree);
console.log(`Parsed ${leaves.length} leaf nodes.`);
console.log('Leaves:', leaves.map(l => l.name).join(', '));

const leafIndex = {};
leaves.forEach((l, i) => { leafIndex[l.id] = i; });
assignEmbeddings(tree, leafIndex, leaves.length);

// The parsed tree root represents the outermost clade; use its children
// directly so the JSON root is a clean "root" node (matching other datasets).
const output = {
  id: 'root',
  name: displayName || path.basename(inputArg, '.nwk'),
  useInternalEmbeddings: true,
  initializeWithPrecomputedPositions: false,
  weightAttribute: 'none',
  centroid: [[0.0, 0.0]],
  children: tree.children ?? [tree],
};

writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');
console.log(`\nWrote: ${outputPath}`);
