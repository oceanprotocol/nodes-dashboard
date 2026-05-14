'use client';

import Button from '@/components/button/button';
import Card from '@/components/card/card';
import Input from '@/components/input/input';
import { useNodeTokensContext } from '@/context/node-tokens';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { createAuthToken } from '@/services/nodeService';
import { DURATION_UNIT_OPTIONS, type DurationUnit, toSeconds } from '@/utils/duration';
import { useFormik } from 'formik';
import posthog from 'posthog-js';
import { toast } from 'react-toastify';
import * as Yup from 'yup';
import styles from './generate-token-card.module.css';

type GenerateTokenCardProps = {
  environmentId: string;
  freeCompute: boolean;
  nodeId: string;
  multiaddrsOrPeerId: string[] | string;
  onTokenGenerated: (token: string) => void;
  tokenAddress?: string;
};

type FormValues = {
  expiryValue: number | '';
  expiryUnit: DurationUnit;
};

const GenerateTokenCard: React.FC<GenerateTokenCardProps> = ({
  environmentId,
  freeCompute,
  multiaddrsOrPeerId,
  nodeId,
  onTokenGenerated,
  tokenAddress,
}) => {
  const { account, ocean, signMessage } = useOceanAccount();
  const { addNodeToken } = useNodeTokensContext();

  const formik = useFormik<FormValues>({
    initialValues: {
      expiryValue: 1,
      expiryUnit: 'hours',
    },
    validationSchema: Yup.object({
      expiryValue: Yup.number()
        .typeError('Must be a number')
        .required('Required')
        .min(0, 'Must be 0 or greater'),
    }),
    onSubmit: async (values) => {
      if (!account.address || !ocean) {
        return;
      }
      try {
        const { token: generatedToken } = await createAuthToken({
          consumerAddress: account.address,
          nodeUri: multiaddrsOrPeerId,
          signMessage,
        });
        const expirySeconds = toSeconds(Number(values.expiryValue), values.expiryUnit);
        const expiryTimestamp = expirySeconds > 0 ? Date.now() + expirySeconds * 1000 : undefined;
        addNodeToken({
          createdAt: Date.now(),
          expiryTimestamp,
          nodeId,
          token: generatedToken,
        });
        onTokenGenerated(generatedToken);
        posthog.capture('authToken_generated', {
          nodeId,
          environmentId,
          freeCompute,
          tokenAddress,
        });
      } catch (error) {
        console.error('Failed to generate auth token:', error);
        toast.error('Failed to generate auth token');
      }
    },
  });

  const expiryError = formik.touched.expiryValue && formik.errors.expiryValue
    ? formik.errors.expiryValue
    : undefined;

  return (
    <Card direction="column" innerShadow="black" padding="sm" radius="sm" spacing="sm" variant="glass">
      <h3>Auth token</h3>
      <div>Generate an auth token to allow Ocean Orchestrator to connect to the node</div>
      <form className="actionsGroupMdBetween" onSubmit={formik.handleSubmit}>
        <Input
          endAdornment={
            <div className={styles.expiryControls}>
              <select
                aria-label="Expiry unit"
                className={styles.unitSelect}
                name="expiryUnit"
                onBlur={formik.handleBlur}
                onChange={formik.handleChange}
                value={formik.values.expiryUnit}
              >
                {DURATION_UNIT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          }
          errorText={expiryError}
          hint="Set to 0 for no expiry"
          label="Token expiry"
          min={0}
          name="expiryValue"
          onBlur={formik.handleBlur}
          onChange={(e) => {
            if (e.target.value === '') {
              formik.setFieldValue('expiryValue', '');
              return;
            }
            formik.setFieldValue('expiryValue', Math.max(0, Number(e.target.value)));
          }}
          size="sm"
          type="number"
          value={formik.values.expiryValue}
        />
        <Button
          autoLoading
          color="accent1"
          disabled={!formik.isValid}
          size="md"
          type="submit"
        >
          Generate token
        </Button>
      </form>
    </Card>
  );
};

export default GenerateTokenCard;
