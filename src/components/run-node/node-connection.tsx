import Button from '@/components/button/button';
import Card from '@/components/card/card';
import Input from '@/components/input/input';
import { useRunNodeContext } from '@/context/run-node-context';
import LinkIcon from '@mui/icons-material/Link';
import classNames from 'classnames';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import styles from './node-connection.module.css';

type ConnectFormValues = {
  nodeId: string;
};

const NodeConnection = () => {
  const { clearRunNodeSelection, connectToNode, peerId } = useRunNodeContext();

  const isConnected = !!peerId;

  const formik = useFormik<ConnectFormValues>({
    initialValues: {
      nodeId: '',
    },
    validationSchema: Yup.object().shape({
      nodeId: Yup.string().required('Node ID is required'),
    }),
    onSubmit: (values) => {
      connectToNode(values.nodeId);
    },
  });

  return (
    <Card direction="column" padding="sm" radius="sm" spacing="sm" variant="glass">
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
            disabled={isConnected}
            errorText={formik.touched.nodeId && formik.errors.nodeId ? formik.errors.nodeId : undefined}
            label="Node ID"
            name="nodeId"
            onBlur={formik.handleBlur}
            onChange={formik.handleChange}
            type="text"
            value={formik.values.nodeId}
          />
          <Button className="alignSelfEnd" color="accent1" contentBefore={<LinkIcon />} onClick={formik.submitForm}>
            Connect
          </Button>
        </>
      )}
    </Card>
  );
};

export default NodeConnection;
