import Button from '@/components/button/button';
import CopyButton from '@/components/button/copy-button';
import { decryptServicePassword } from '@/lib/service-password';
import { useServicePasswordKey } from '@/lib/use-service-password-key';
import { useState } from 'react';

type ServicePasswordRevealProps = {
  blob: string | null;
  /** Held by the parent so the curl snippet can show it too. */
  password: string | null;
  onReveal: (password: string) => void;
  /** Templates sign in their own way (some keep the app's own login), so they point to the README. */
  isTemplate?: boolean;
};

const MODEL_HELP = 'Send this password as `Authorization: Bearer <password>` (the API key in OpenAI clients).';
const TEMPLATE_HELP = "Use this password to sign in. The template's README shows how to call it by API.";

const ServicePasswordReveal: React.FC<ServicePasswordRevealProps> = ({ blob, password, onReveal, isTemplate }) => {
  const { getKey } = useServicePasswordKey();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const reveal = async () => {
    if (!blob) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const key = await getKey();
      if (!key) {
        throw new Error('no key');
      }
      onReveal(await decryptServicePassword(key, blob));
    } catch {
      setError('This wallet cannot unlock this password. Set a new one with Edit.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {!blob ? (
        <span className="textSecondary">Password not stored for this service.</span>
      ) : password ? (
        <>
          <code className="ph-no-capture">{password}</code> <CopyButton contentToCopy={password} size="sm" />
        </>
      ) : (
        <Button color="accent1" loading={loading} onClick={reveal} size="sm" variant="outlined">
          Reveal password
        </Button>
      )}
      {error && <div className="textAccent1">{error}</div>}
      {blob && <div className="textSecondary">{isTemplate ? TEMPLATE_HELP : MODEL_HELP}</div>}
    </div>
  );
};

export default ServicePasswordReveal;
