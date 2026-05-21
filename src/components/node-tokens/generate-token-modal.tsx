'use client';

import Button from '@/components/button/button';
import Input from '@/components/input/input';
import Modal from '@/components/modal/modal';
import { useNodeTokensContext } from '@/context/node-tokens';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { createAuthToken } from '@/services/nodeService';
import { DURATION_UNIT_OPTIONS, type DurationUnit, toSeconds } from '@/utils/duration';
import { useFormik } from 'formik';
import posthog from 'posthog-js';
import { toast } from 'react-toastify';
import * as Yup from 'yup';
import styles from './generate-token-modal.module.css';

type GenerateTokenModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onTokenGenerated?: (token: string) => void;
};

type FormValues = {
  nodeId: string;
  expiryValue: number | '';
  expiryUnit: DurationUnit;
};

const GenerateTokenModal: React.FC<GenerateTokenModalProps> = ({ isOpen, onClose, onTokenGenerated }) => {
  const { account, signMessage } = useOceanAccount();
  const { addNodeToken } = useNodeTokensContext();

  const formik = useFormik<FormValues>({
    initialValues: {
      nodeId: '',
      expiryValue: '',
      expiryUnit: 'hours',
    },
    validationSchema: Yup.object({
      nodeId: Yup.string().required('Node ID is required'),
      expiryValue: Yup.number().typeError('Must be a number').min(0, 'Must be 0 or greater'),
    }),
    onSubmit: async (values, { resetForm }) => {
      if (!account.address) {
        return;
      }
      try {
        const expirySeconds = values.expiryValue !== '' ? toSeconds(Number(values.expiryValue), values.expiryUnit) : 0;
        const validUntil = expirySeconds > 0 ? Date.now() + expirySeconds * 1000 : undefined;
        const { token: generatedToken } = await createAuthToken({
          consumerAddress: account.address,
          nodeUri: values.nodeId,
          signMessage,
          validUntil,
        });
        addNodeToken({
          createdAt: Date.now(),
          expiryTimestamp: validUntil,
          nodeId: values.nodeId,
          nodeUri: values.nodeId,
          token: generatedToken,
        });
        posthog.capture('authToken_generated', { nodeId: values.nodeId });
        toast.success('Auth token generated');
        resetForm();
        onTokenGenerated?.(generatedToken);
        onClose();
      } catch (error) {
        console.error('Failed to generate auth token:', error);
        toast.error('Failed to generate auth token');
      }
    },
  });

  const handleClose = () => {
    if (formik.isSubmitting) {
      return;
    }
    formik.resetForm();
    onClose();
  };

  const expiryError = formik.touched.expiryValue && formik.errors.expiryValue ? formik.errors.expiryValue : undefined;

  return (
    <Modal
      hideCloseButton={formik.isSubmitting}
      isOpen={isOpen}
      onClose={handleClose}
      title="Generate auth token"
      width="sm"
    >
      <form className={styles.form} onSubmit={formik.handleSubmit}>
        <Input
          errorText={formik.touched.nodeId && formik.errors.nodeId ? formik.errors.nodeId : undefined}
          label="Node ID"
          name="nodeId"
          onBlur={formik.handleBlur}
          onChange={formik.handleChange}
          placeholder="Enter node peer ID"
          type="text"
          value={formik.values.nodeId}
        />
        <Input
          endAdornment={
            <div className={styles.expiryControls}>
              <select
                aria-label="Expiration unit"
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
          label="Token expiration (optional)"
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
          type="number"
          value={formik.values.expiryValue}
        />
        <div className="actionsGroupMdEnd">
          <Button
            color="accent1"
            disabled={formik.isSubmitting}
            onClick={handleClose}
            size="md"
            type="button"
            variant="outlined"
          >
            Cancel
          </Button>
          <Button color="accent1" disabled={!formik.isValid} loading={formik.isSubmitting} size="md" type="submit">
            Generate
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default GenerateTokenModal;
