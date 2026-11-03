// The family tree across the lineage (docs/appearance/19-ally-successors.md, docs/lore/heirs/): the lives of the family in the order they were lived, each with
// the one who took over from it; beside the life now, its household (partners, children with the heir marked, brothers and sisters, the elders) and the dead.
// The bond book of a life that has ended is not kept (only the heir's own book), so the earlier generations show the life and its heir, not their households.
import { store } from '../../app/store';
import { ALLIES_W, familyTree, type GenView, type KinNode, type TreeView } from '../../app/views/allies';
import type { GameData } from '../../core/game';
import type { GameState } from '../../core/types';
import { color } from '../tokens';
import { LineIcon } from './glyphs';
import { css, inkOf, lineOf } from './style';

export interface TreeProps {
  data?: GameData;
  state?: GameState | null;
}

/** The tree on its own (the allies screen draws it in a tab; the storybook draws it alone). */
export function FamilyTree(props: TreeProps) {
  void store.rev.value;
  const data = props.data ?? store.gameData;
  const state = props.state ?? store.state;
  if (!data || !state) return null;
  const tree = familyTree(data, state);
  if (tree.generations.length === 0 && tree.children.length === 0) return <div class="al-empty">{ALLIES_W.noTree}</div>;
  return (
    <div class="al-tree" data-screen="family-tree">
      <style>{css}</style>
      <TreeBody tree={tree} dead={!!state.life?.dead} />
    </div>
  );
}

function Gen({ g, last, heirOf }: { g: GenView; last: boolean; heirOf: string | null }) {
  const cls = `al-node${g.alive ? '' : ' dead'}${g.current ? ' current' : ''}`;
  return (
    <div data-gen={g.n}>
      <div class={cls} style={{ maxWidth: 300 }}>
        <div class="al-small al-dim">
          {ALLIES_W.generation} {g.n} · {g.origin}
        </div>
        <div style={{ fontSize: 18 }}>
          {!g.alive && <span aria-hidden="true">† </span>}
          {g.name}
        </div>
        <div class="al-small al-dim">
          {g.raceName} · {g.years}
          {g.age !== null ? ` · ${ALLIES_W.age} ${g.age}` : ''}
        </div>
        {g.cause && <div class="al-small al-dim">{g.cause}</div>}
        {g.ending && <div class="al-small" style={{ color: color.light }}>{g.ending}</div>}
        {g.alive && <div class="al-small" style={{ color: color.text }}>{ALLIES_W.current}</div>}
        {g.heir && (
          <div class="al-small" style={{ color: color.light, marginTop: 4 }}>
            {ALLIES_W.heir}: {g.heir}
          </div>
        )}
        {!g.heir && g.current && heirOf && (
          <div class="al-small" style={{ color: color.light, marginTop: 4 }}>
            {ALLIES_W.heir}: {heirOf}
          </div>
        )}
      </div>
      {!last && <div class="al-link gold" aria-hidden="true" />}
    </div>
  );
}

function Kin({ k, dead }: { k: KinNode; dead: boolean }) {
  const cls = `al-node${k.alive ? '' : ' dead'}${k.heir ? ' heir' : ''}`;
  return (
    <div class={cls} data-kin={k.id} style={{ borderLeft: `3px solid ${lineOf(k.line)}`, minWidth: 140 }}>
      <div class="al-small" style={{ display: 'flex', gap: 6, alignItems: 'center', color: inkOf(k.line) }}>
        <LineIcon line={k.line} size={14} />
        {k.role}
        {k.stage ? ` · ${k.stage}` : ''}
      </div>
      <div>
        {!k.alive && <span aria-hidden="true">† </span>}
        {k.name}
      </div>
      <div class="al-small al-dim">
        {k.died ?? (k.age !== null ? `${ALLIES_W.age} ${k.age}` : '')}
      </div>
      {k.other && (
        <div class="al-small al-dim">
          {ALLIES_W.otherParent}: {k.other}
        </div>
      )}
      {k.married && (
        <div class="al-small al-dim">
          {ALLIES_W.married} {k.married}
        </div>
      )}
      {k.heir && (
        <div class="al-small" style={{ color: color.light }}>
          {dead ? ALLIES_W.heir : ALLIES_W.heirNext}
        </div>
      )}
    </div>
  );
}

function Row({ title, list, dead }: { title: string; list: KinNode[]; dead: boolean }) {
  if (list.length === 0) return null;
  return (
    <section style={{ marginBottom: 14 }} aria-label={title} data-kin-group={title}>
      <div class="al-small al-dim" style={{ marginBottom: 6 }}>
        {title} · {list.length}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {list.map((k) => (
          <Kin key={k.id} k={k} dead={dead} />
        ))}
      </div>
    </section>
  );
}

function TreeBody({ tree, dead }: { tree: TreeView; dead: boolean }) {
  const heirIsKid = tree.children.some((c) => c.heir);
  const house = tree.partners.length + tree.children.length + tree.siblings.length + tree.elders.length > 0;
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
        <span class="al-title">
          {ALLIES_W.dynasty} {tree.dynasty}
        </span>
        <span class="al-dim">
          {tree.generations.length} {ALLIES_W.generation.replace('ที่', '')}
        </span>
        {tree.extinct && <span style={{ color: color.dread }}>{ALLIES_W.extinct}</span>}
      </div>
      <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start' }}>
        <div style={{ flex: '0 0 auto' }}>
          {tree.generations.map((g, i) => (
            <Gen key={g.id} g={g} last={i === tree.generations.length - 1} heirOf={tree.heir && !heirIsKid ? `${tree.heir.name} (${tree.heir.how})` : tree.heir?.name ?? null} />
          ))}
        </div>
        {house && (
          <div style={{ flex: 1, minWidth: 0 }} aria-label={ALLIES_W.current}>
            <Row title={ALLIES_W.partners} list={tree.partners} dead={dead} />
            <Row title={ALLIES_W.children} list={tree.children} dead={dead} />
            <Row title={ALLIES_W.siblings} list={tree.siblings} dead={dead} />
            <Row title={ALLIES_W.elders} list={tree.elders} dead={dead} />
            {tree.children.length === 0 && !tree.heir && (
              <p class="al-dim">{ALLIES_W.noHeir}</p>
            )}
          </div>
        )}
      </div>
      {tree.dead.length > 0 && (
        <section style={{ marginTop: 18, borderTop: `1px solid ${color.line}`, paddingTop: 10 }} aria-label={ALLIES_W.dead} data-section="dead">
          <div class="al-small al-dim" style={{ marginBottom: 6 }}>
            {ALLIES_W.dead} · {tree.dead.length}
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, columnCount: 2, columnGap: 24 }}>
            {tree.dead.map((d, i) => (
              <li key={i} class="al-small" style={{ padding: '2px 0' }}>
                † {d.name} <span class="al-dim">({d.role}{d.note ? ` · ${d.note}` : ''})</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
