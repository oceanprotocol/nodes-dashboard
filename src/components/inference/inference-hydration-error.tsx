import Button from '@/components/button/button';
import Card from '@/components/card/card';
import { useInferenceContext } from '@/context/inference-context';

/**
 * Shown when a selection encoded in the URL couldn't be restored (HF/env fetch failed, or a model
 * or environment no longer exists). Offers a retry instead of silently bouncing the user back and
 * discarding the selection the URL still holds.
 */
const InferenceHydrationError: React.FC = () => {
  const { retryHydration } = useInferenceContext();

  return (
    <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
      <h3>Couldn&apos;t load your selection</h3>
      <div className="textSecondary">
        We couldn&apos;t restore part of your selection from the link. A model or environment may be unavailable
        right now, or one no longer exists. Retry, or start over from the model picker.
      </div>
      <div className="actionsGroupMdEnd">
        <Button color="accent1" href="/inference/custom-models" variant="outlined">
          Start over
        </Button>
        <Button color="accent1" onClick={retryHydration} type="button" variant="filled">
          Retry
        </Button>
      </div>
    </Card>
  );
};

export default InferenceHydrationError;
