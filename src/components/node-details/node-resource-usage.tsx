import Card from '@/components/card/card';
import NodeUsageHistory from '@/components/node-details/node-usage-history';
import NodeUsagePanel from '@/components/resource-usage/node-usage-panel';
import { useNodeUsageSamples } from '@/hooks/use-metrics-history';
import { useNodeMetrics } from '@/hooks/use-node-metrics';
import { Node } from '@/types';
import { ComputeEnvironment } from '@/types/environments';
import { isBenchmarkEnv } from '@/utils/env-resources';
import { resourceDescriptionsById } from '@/utils/resources';
import { useMemo } from 'react';

type NodeResourceUsageProps = {
  envs: ComputeEnvironment[];
  node: Node;
};

/**
 * Live node-wide resource usage plus the node's own hourly history. Public: `getNodeMetrics` and
 * `getNodeMetricsHistory` carry no auth, ownership or signature check, and this page's subtitle
 * ("Check node status, performance, and available resources before running a job") is addressed to a
 * prospective consumer rather than to the operator.
 *
 * Once a snapshot has arrived, later failures keep it on screen: the panel's "Updated 4m ago" line
 * is a more honest staleness signal than swapping the readings for an error.
 */
const NodeResourceUsage: React.FC<NodeResourceUsageProps> = ({ envs, node }) => {
  const nodeId = node.id ?? node.nodeId;
  const addrsKey = node.currentAddrs?.join('|') ?? '';
  const multiaddrs = useMemo(() => (addrsKey ? addrsKey.split('|') : undefined), [addrsKey]);

  const { snapshot, status } = useNodeMetrics({ multiaddrs, peerId: nodeId });

  // One map across every environment: resource ids (`cpu`, `gpu0`, …) are node-wide, but the human
  // name only lives on an environment's resource description — the metrics payload carries just ids.
  const hardwareNames = useMemo(
    () =>
      envs.reduce<Record<string, string>>(
        (names, env) => ({ ...names, ...resourceDescriptionsById(env.resources) }),
        {}
      ),
    [envs]
  );

  // The node's own benchmark environment duplicates its "real" sibling's cpu/ram/disk/GPU figures on
  // the wire rather than offering a second pool (its id shares that sibling's resource prefix) — so
  // every env-based total/booked figure below has to drop it, or a node with one paid environment
  // reports double its actual capacity. `env.id` is the compute-environment id; the metrics payload's
  // `env[]` rows key off the SAME string, which is what makes this set usable there.
  const benchmarkEnvIds = useMemo(
    () => new Set(envs.filter(isBenchmarkEnv).map((env) => env.id)),
    [envs]
  );
  const samples = useNodeUsageSamples(snapshot, nodeId, benchmarkEnvIds);

  if (!snapshot) {
    return null;
  }

  return (
    <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
      <NodeUsagePanel
        excludeEnvIds={benchmarkEnvIds}
        hardwareNames={hardwareNames}
        history={samples}
        metrics={snapshot}
        title={<h3>Node resource usage</h3>}
        variant="page"
      />
      {/* Gated on the live read having succeeded, so a node that predates these commands never eats a
          second 501 round trip. */}
      <NodeUsageHistory enabled excludeEnvIds={benchmarkEnvIds} multiaddrs={multiaddrs} peerId={nodeId} />
    </Card>
  );
};

export default NodeResourceUsage;
