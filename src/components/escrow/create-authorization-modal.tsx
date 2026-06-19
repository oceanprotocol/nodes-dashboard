import Button from '@/components/button/button';
import styles from '@/components/escrow/authorization-form.module.css';
import Input from '@/components/input/input';
import Modal from '@/components/modal/modal';
import { getApiRoute } from '@/config';
import { useAuthorizeTokens } from '@/lib/use-authorize-tokens';
import { Node } from '@/types/nodes';
import axios from 'axios';
import { useFormik } from 'formik';
import * as Yup from 'yup';

type CreateAuthorizationModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  tokenAddress: string;
  tokenSymbol: string;
  // Consumers that already have an authorization for this token — used to block duplicates.
  existingConsumers: string[];
};

type FormValues = {
  nodeId: string;
  maxLockedAmount: number;
  maxLockSeconds: number;
  maxLockCount: number;
};

const MIN_LOCK_SECONDS = 1;
const MIN_LOCK_COUNT = 1;

const CreateAuthorizationModal = ({
  isOpen,
  onClose,
  onSuccess,
  tokenAddress,
  tokenSymbol,
  existingConsumers,
}: CreateAuthorizationModalProps) => {
  const { handleAuthorize, isAuthorizing } = useAuthorizeTokens({ onSuccess });

  const formik = useFormik<FormValues>({
    enableReinitialize: true,
    initialValues: { nodeId: '', maxLockedAmount: 0, maxLockSeconds: 1, maxLockCount: 1 },
    validateOnMount: true,
    validationSchema: Yup.object({
      nodeId: Yup.string().trim().required('Required'),
      maxLockedAmount: Yup.number().required('Required').min(0, 'Invalid amount'),
      maxLockSeconds: Yup.number()
        .required('Required')
        .integer('Integer required')
        .min(MIN_LOCK_SECONDS, `Minimum ${MIN_LOCK_SECONDS}`),
      maxLockCount: Yup.number()
        .required('Required')
        .integer('Integer required')
        .min(MIN_LOCK_COUNT, `Minimum ${MIN_LOCK_COUNT}`),
    }),
    onSubmit: async (values, { setFieldError }) => {
      const consumer = await resolveConsumer(values.nodeId.trim(), setFieldError);
      if (!consumer) {
        return;
      }
      if (existingConsumers.some((c) => c.toLowerCase() === consumer.toLowerCase())) {
        setFieldError('nodeId', 'This node already has an authorization');
        return;
      }
      await handleAuthorize({
        tokenAddress,
        peerId: values.nodeId.trim(),
        spender: consumer,
        maxLockedAmount: values.maxLockedAmount.toString(),
        maxLockSeconds: values.maxLockSeconds.toString(),
        maxLockCount: values.maxLockCount.toString(),
      });
    },
  });

  // Fetch node by id, derive consumer address from one of its compute envs.
  const resolveConsumer = async (
    nodeId: string,
    setFieldError: (field: string, message: string | undefined) => void
  ): Promise<string | null> => {
    try {
      const response = await axios.get(`${getApiRoute('nodes')}?page=0&size=1&nodeId=${nodeId}`);
      const node: Node | undefined = response.data?.nodes?.[0]?._source;
      if (!node) {
        setFieldError('nodeId', 'Node not found');
        return null;
      }
      const consumer = node.computeEnvironments?.environments?.find((env) => env.consumerAddress)?.consumerAddress;
      if (!consumer) {
        setFieldError('nodeId', 'Node has no compute environment with a consumer address');
        return null;
      }
      return consumer;
    } catch (error) {
      console.error('Error resolving node consumer address: ', error);
      setFieldError('nodeId', 'Failed to fetch node');
      return null;
    }
  };

  const handleClose = () => {
    formik.resetForm();
    onClose();
  };

  const loading = isAuthorizing || formik.isSubmitting;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create authorization" width="sm">
      <form className={styles.root} onSubmit={formik.handleSubmit}>
        <Input
          errorText={formik.touched.nodeId && formik.errors.nodeId ? formik.errors.nodeId : undefined}
          label="Node ID"
          name="nodeId"
          onBlur={formik.handleBlur}
          onChange={formik.handleChange}
          placeholder="Node peer ID"
          type="text"
          value={formik.values.nodeId}
        />
        <div className={styles.inputs}>
          <Input
            endAdornment={tokenSymbol}
            errorText={
              formik.touched.maxLockedAmount && formik.errors.maxLockedAmount
                ? formik.errors.maxLockedAmount
                : undefined
            }
            label="Max locked amount"
            name="maxLockedAmount"
            onBlur={formik.handleBlur}
            onChange={formik.handleChange}
            step="any"
            type="number"
            value={formik.values.maxLockedAmount}
          />
          <Input
            endAdornment="seconds"
            errorText={
              formik.touched.maxLockSeconds && formik.errors.maxLockSeconds ? formik.errors.maxLockSeconds : undefined
            }
            label="Max lock seconds"
            name="maxLockSeconds"
            onBlur={formik.handleBlur}
            onChange={formik.handleChange}
            type="number"
            value={formik.values.maxLockSeconds}
          />
          <Input
            endAdornment="locks"
            errorText={
              formik.touched.maxLockCount && formik.errors.maxLockCount ? formik.errors.maxLockCount : undefined
            }
            label="Max lock count"
            name="maxLockCount"
            onBlur={formik.handleBlur}
            onChange={formik.handleChange}
            type="number"
            value={formik.values.maxLockCount}
          />
        </div>
        <div className="actionsGroupLgBetween">
          <Button
            color="accent1"
            disabled={loading}
            onClick={handleClose}
            size="md"
            type="button"
            variant="transparent"
          >
            Cancel
          </Button>
          <Button color="accent1" disabled={!formik.isValid} loading={loading} size="md" type="submit">
            Create
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default CreateAuthorizationModal;
