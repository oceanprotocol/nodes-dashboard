import Button from '@/components/button/button';
import Card from '@/components/card/card';
import Input from '@/components/input/input';
import { useRunNodeContext } from '@/context/run-node-context';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { useAuthModal } from '@account-kit/react';
import LinkIcon from '@mui/icons-material/Link';
import classNames from 'classnames';
import { useFormik } from 'formik';
import { useEffect } from 'react';
import * as Yup from 'yup';
import styles from './node-connection.module.css';

type ConnectFormValues = {
  nodeId: string;
};

const NodeConnection = () => {
  const { closeAuthModal, isOpen: isAuthModalOpen, openAuthModal } = useAuthModal();

  const { account } = useOceanAccount();

  const { clearRunNodeSelection, connectToNode, peerId } = useRunNodeContext();

  // This is a workaround for the modal not closing after connecting
  // https://github.com/alchemyplatform/aa-sdk/issues/2327
  // TODO remove once the issue is fixed
  useEffect(() => {
    if (isAuthModalOpen && account.isConnected) {
      closeAuthModal();
    }
  }, [account.isConnected, closeAuthModal, isAuthModalOpen]);

  const isConnected = !!peerId;

  const formik = useFormik<ConnectFormValues>({
    initialValues: {
      nodeId: '',
    },
    validationSchema: Yup.object().shape({
      nodeId: Yup.string().required('Node ID is required'),
    }),
    onSubmit: async (values) => {
      if (!account.isConnected) {
        openAuthModal();
        return;
      }
      await connectToNode(values.nodeId);
    },
  });

  return (
    <Card direction="column" padding="sm" radius="sm" shadow="black" spacing="sm" variant="glass">
      <div className={styles.header}>
        <h3>Connect to your node</h3>
        <div className={classNames('chip', { chipError: !isConnected, chipSuccess: isConnected })}>
          {isConnected ? 'Connected' : 'Not connected'}
        </div>
      </div>
      {isConnected ? (
        <>
          <div>
            Currently connected to node ID: <strong>{peerId}</strong>
          </div>
          <Button className="alignSelfEnd" color="accent1" onClick={clearRunNodeSelection} variant="outlined">
            Connect to another node
          </Button>
        </>
      ) : (
        <>
          <div>Enter the ID of your node to connect and configure it</div>
          <Input
            errorText={formik.touched.nodeId && formik.errors.nodeId ? formik.errors.nodeId : undefined}
            label="Node ID"
            name="nodeId"
            onBlur={formik.handleBlur}
            onChange={formik.handleChange}
            type="text"
            value={formik.values.nodeId}
          />
          <Button
            className="alignSelfEnd"
            color="accent1"
            contentBefore={<LinkIcon />}
            loading={formik.isSubmitting}
            onClick={formik.submitForm}
          >
            Connect
          </Button>
        </>
      )}
    </Card>
  );
};

export default NodeConnection;
