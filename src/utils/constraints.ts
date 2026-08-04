import { ComputeResource, ResourceConstraint } from '@/types/environments';

// Cross-resource constraint enforcement for the "select resources" page.
//
// This is a client-side mirror of ocean-node's server enforcement
// (src/components/c2d/compute_engine_base.ts: checkResourceConstraints). The node
// rejects any job whose resource request violates these constraints, so the dashboard
// must not let the user build (or submit) such a request.
//
// `resolveConstraints` is a faithful port used as the authoritative correctness check
// (Yup backstop + package-mode feasibility): given a full selection it raises floors and
// throws on any ceiling/feasibility violation, covering all four semantics
// (ratio / floor / aggregate / type-group).
//
// `deriveBounds` turns that one-directional validation into per-resource [min, max]
// bounds used to clamp the sliders live (the common direct single-`id` case). The
// backstop guarantees correctness even where bound derivation is intentionally partial
// (e.g. `type`-group targets, which have no single slider to bound).

export type ResourceRequest = { id: string; amount: number };
export type Bounds = { min: number; max: number };
export type BoundsMap = Record<string, Bounds>;

const getResource = (resources: ComputeResource[], id: string): ComputeResource | undefined =>
  resources.find((r) => r.id === id);

const getRequest = (requested: ResourceRequest[], id: string): number | undefined =>
  requested.find((r) => r.id === id)?.amount;

const setRequest = (requested: ResourceRequest[], id: string, amount: number): void => {
  for (const r of requested) {
    if (r.id === id) {
      r.amount = amount;
      return;
    }
  }
  requested.push({ id, amount });
};

// Ids of every resource whose `type` matches — the members a `type`-group constraint aggregates over.
const getGroupResourceIds = (resources: ComputeResource[], type: string): string[] =>
  resources.filter((r) => r.type === type).map((r) => r.id);

const getGroupRequestedAmount = (requested: ResourceRequest[], ids: string[]): number =>
  ids.reduce((sum, id) => sum + (getRequest(requested, id) ?? 0), 0);

const getGroupMax = (resources: ComputeResource[], ids: string[]): number =>
  ids.reduce((sum, id) => sum + (getResource(resources, id)?.max ?? 0), 0);

// Raise members of a `type` group until their combined requested amount grows by `deficit`,
// preferring members with the most availability (lowest inUse), never exceeding any member's max.
const bumpGroupToFloor = (
  resources: ComputeResource[],
  requested: ResourceRequest[],
  ids: string[],
  deficit: number
): void => {
  let remaining = deficit;
  const candidates = ids
    .map((id) => {
      const current = getRequest(requested, id) ?? 0;
      const max = getResource(resources, id)?.max ?? 0;
      const inUse = getResource(resources, id)?.inUse ?? 0;
      return { id, current, headroom: max - current, inUse };
    })
    .filter((c) => c.headroom > 0)
    .sort((a, b) => a.inUse - b.inUse);
  for (const c of candidates) {
    if (remaining <= 0) break;
    const bump = Math.min(c.headroom, remaining);
    setRequest(requested, c.id, c.current + bump);
    remaining -= bump;
  }
};

// Non-aggregate constraints. 'min' raises targets to their floors (throwing when a floor exceeds
// the target's own max); 'max' rejects ceiling violations. Mirrors enforceDirectConstraints.
const enforceDirectConstraints = (
  resources: ComputeResource[],
  requested: ResourceRequest[],
  phase: 'min' | 'max'
): void => {
  for (const parent of resources) {
    if (!parent.constraints || parent.constraints.length === 0) continue;
    const parentAmount = getRequest(requested, parent.id);
    if (!parentAmount || parentAmount <= 0) continue;

    for (const constraint of parent.constraints) {
      if (constraint.aggregate) continue; // handled in applyAggregateConstraints
      const perUnit = constraint.perUnit !== false;
      const isGroup = constraint.type !== undefined;
      const targetIds = isGroup ? getGroupResourceIds(resources, constraint.type!) : [constraint.id as string];
      const targetLabel = isGroup ? `${constraint.type} resources` : String(constraint.id);
      const constrainedAmount = isGroup
        ? getGroupRequestedAmount(requested, targetIds)
        : (getRequest(requested, constraint.id as string) ?? 0);

      if (phase === 'min' && constraint.min !== undefined) {
        const requiredMin = perUnit ? parentAmount * constraint.min : constraint.min;
        if (constrainedAmount < requiredMin) {
          const targetMax = isGroup
            ? getGroupMax(resources, targetIds)
            : (getResource(resources, constraint.id as string)?.max ?? 0);
          if (requiredMin > targetMax) {
            throw new Error(
              `Cannot satisfy constraint: ${parentAmount} ${parent.id} requires at least ${requiredMin} ${targetLabel}, but max is ${targetMax}`
            );
          }
          if (isGroup) {
            bumpGroupToFloor(resources, requested, targetIds, requiredMin - constrainedAmount);
          } else {
            setRequest(requested, constraint.id as string, requiredMin);
          }
        }
      }

      if (phase === 'max' && constraint.max !== undefined) {
        const requiredMax = perUnit ? parentAmount * constraint.max : constraint.max;
        if (constrainedAmount > requiredMax) {
          throw new Error(
            `Too much ${targetLabel} for ${parentAmount} ${parent.id}. Max allowed: ${requiredMax}, requested: ${constrainedAmount}`
          );
        }
      }
    }
  }
};

// Aggregate constraints (`aggregate: true`) sum their per-parent contribution additively into a
// shared single-`id` target across every requested parent. Mirrors applyAggregateConstraints.
const applyAggregateConstraints = (resources: ComputeResource[], requested: ResourceRequest[]): void => {
  const summedMin = new Map<string, number>();
  const summedMax = new Map<string, number>();
  const hasMax = new Set<string>();

  for (const parent of resources) {
    if (!parent.constraints || parent.constraints.length === 0) continue;
    const parentAmount = getRequest(requested, parent.id) ?? 0;
    if (parentAmount <= 0) continue;
    for (const c of parent.constraints) {
      if (!c.aggregate || c.id === undefined) continue;
      const perUnit = c.perUnit !== false;
      if (c.min !== undefined) {
        summedMin.set(c.id, (summedMin.get(c.id) ?? 0) + (perUnit ? parentAmount * c.min : c.min));
      }
      if (c.max !== undefined) {
        summedMax.set(c.id, (summedMax.get(c.id) ?? 0) + (perUnit ? parentAmount * c.max : c.max));
        hasMax.add(c.id);
      }
    }
  }

  for (const [targetId, requiredMin] of summedMin) {
    const current = getRequest(requested, targetId) ?? 0;
    if (current < requiredMin) {
      const targetMax = getResource(resources, targetId)?.max ?? 0;
      if (requiredMin > targetMax) {
        throw new Error(
          `Cannot satisfy aggregate constraint: requires at least ${requiredMin} ${targetId}, but max is ${targetMax}`
        );
      }
      setRequest(requested, targetId, requiredMin);
    }
  }

  for (const targetId of hasMax) {
    const current = getRequest(requested, targetId) ?? 0;
    const requiredMax = summedMax.get(targetId)!;
    if (current > requiredMax) {
      throw new Error(
        `Too much ${targetId} for the requested resources. Max allowed: ${requiredMax}, requested: ${current}`
      );
    }
  }
};

/**
 * Faithful port of ocean-node checkResourceConstraints. Two-phase on purpose: all floors settle
 * first (direct min, then aggregate), then every ceiling is validated against the final amounts,
 * so the outcome is independent of resource ordering. Mutates a COPY and returns it; throws on any
 * ceiling/feasibility violation with the same message shape the node produces.
 */
export const resolveConstraints = (
  resources: ComputeResource[],
  requested: ResourceRequest[]
): ResourceRequest[] => {
  const result = requested.map((r) => ({ ...r }));
  // Ensure every constrained resource has an entry so setRequest/getRequest resolve.
  for (const r of resources) if (getRequest(result, r.id) === undefined) result.push({ id: r.id, amount: 0 });
  enforceDirectConstraints(resources, result, 'min');
  applyAggregateConstraints(resources, result);
  enforceDirectConstraints(resources, result, 'max');
  return result;
};

/** True when the selection satisfies every constraint (server would accept it). */
export const isSelectionValid = (resources: ComputeResource[], requested: ResourceRequest[]): boolean => {
  try {
    resolveConstraints(resources, requested);
    return true;
  } catch {
    return false;
  }
};

/** The constraint violation message for a selection, or null when valid. */
export const constraintError = (resources: ComputeResource[], requested: ResourceRequest[]): string | null => {
  try {
    resolveConstraints(resources, requested);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Invalid resource selection';
  }
};

/**
 * Per-resource [min, max] bounds for the sliders, given the current selection of the other
 * (parent) resources. `base` supplies each resource's availability envelope (min = per-job min,
 * max = currently available). Covers direct single-`id` constraints in both directions:
 *  - forward: a parent's current amount raises/caps its child's bounds (ratio and floor);
 *  - backward: a child's own availability ceiling caps how high the parent can go.
 * `type`-group and aggregate targets are left to resolveConstraints (the Yup backstop) — they have
 * no single slider to bound.
 */
export const deriveBounds = (
  resources: ComputeResource[],
  selections: Record<string, number>,
  base: BoundsMap
): BoundsMap => {
  const bounds: BoundsMap = {};
  for (const r of resources) {
    const b = base[r.id] ?? { min: r.min ?? 0, max: r.max ?? 0 };
    bounds[r.id] = { min: b.min, max: b.max };
  }

  for (const parent of resources) {
    if (!parent.constraints || parent.constraints.length === 0) continue;
    const parentAmount = selections[parent.id] ?? 0;

    for (const c of parent.constraints) {
      if (c.aggregate || c.type !== undefined || c.id === undefined) continue; // slider-bound only direct single-id
      const target = c.id;
      if (!bounds[target]) continue;
      const perUnit = c.perUnit !== false;
      const childCeil = (base[target] ?? bounds[target]).max;

      // forward: constrain the child from the parent's current amount. Only when the parent is
      // actually requested (> 0) — the node skips inactive parents, so a 0-parent must not, e.g.,
      // zero the child via a ratio ceiling.
      if (parentAmount > 0) {
        if (c.max !== undefined) {
          bounds[target].max = Math.min(bounds[target].max, perUnit ? parentAmount * c.max : c.max);
        }
        if (c.min !== undefined) {
          bounds[target].min = Math.max(bounds[target].min, perUnit ? parentAmount * c.min : c.min);
        }
      }

      // backward: cap the parent so the child's floor can never exceed the child's own ceiling
      // (independent of the parent's current amount — it bounds how high the parent may go).
      if (c.min !== undefined && bounds[parent.id]) {
        if (perUnit && c.min > 0) {
          bounds[parent.id].max = Math.min(bounds[parent.id].max, Math.floor(childCeil / c.min));
        } else if (!perUnit && c.min > childCeil) {
          bounds[parent.id].max = Math.min(bounds[parent.id].max, 0);
        }
      }
    }
  }

  // Keep every range coherent (max never below min).
  for (const id of Object.keys(bounds)) {
    bounds[id].max = Math.max(bounds[id].min, bounds[id].max);
  }
  return bounds;
};
