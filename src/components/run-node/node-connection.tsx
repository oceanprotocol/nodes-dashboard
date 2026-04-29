import Button from '@/components/button/button';
import Card from '@/components/card/card';
import Input from '@/components/input/input';
import { useRunNodeContext } from '@/context/run-node-context';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { formatWalletAddress } from '@/utils/formatters';
import { usePrivy } from '@privy-io/react-auth';
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
  const { login } = usePrivy();

  const { account } = useOceanAccount();

  const { clearRunNodeSelection, connectToNode, isP2PReady, peerId } = useRunNodeContext();

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
        login();
        return;
      }
      await connectToNode(values.nodeId);
    },
  });

  return (
    <Card direction="column" innerShadow="black" padding="sm" radius="sm" spacing="sm" variant="glass">
      <div className={styles.header}>
        <h3>Connect to your node</h3>
        <div className={classNames('chip', { chipError: !isConnected, chipSuccess: isConnected })}>
          {isConnected ? 'Connected' : 'Not connected'}
        </div>
      </div>
      {isConnected ? (
        <>
          <div>
            Currently connected to node ID: <strong title={peerId}>{formatWalletAddress(peerId)}</strong>
          </div>
          <div className="actionsGroupMdEnd">
            <Button color="accent1" onClick={clearRunNodeSelection} variant="outlined">
              Connect to another node
            </Button>
          </div>
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
          <div className="actionsGroupMdEnd">
            <Button
              color="accent1"
              contentBefore={isP2PReady ? <LinkIcon /> : null}
              loading={!isP2PReady || formik.isSubmitting}
              onClick={formik.submitForm}
            >
              {isP2PReady ? 'Connect' : 'Initializing...'}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
};

export default NodeConnection;
