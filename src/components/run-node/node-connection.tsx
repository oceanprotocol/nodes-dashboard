import Button from '@/components/button/button';
import Card from '@/components/card/card';
import Input from '@/components/input/input';
import { useRunNodeContext } from '@/context/run-node-context';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import classNames from 'classnames';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import styles from './node-connection.module.css';

type ConnectFormValues = {
  nodeId: string;
};

const NodeConnection = () => {
  const { isConnected, setIsConnected } = useRunNodeContext();

  const formik = useFormik<ConnectFormValues>({
    initialValues: {
      nodeId: '',
    },
    validationSchema: Yup.object().shape({
      nodeId: Yup.string().required('Node ID is required'),
    }),
    onSubmit: (values) => {
      console.log(values);
      setIsConnected(true);
    },
  });

  const handleDisconnect = () => {
    setIsConnected(false);
  };

  return (
    <Card direction="column" padding="sm" radius="sm" spacing="sm" variant="glass">
      <div className={styles.header}>
        <h3>Connect to your node</h3>
        <div className={classNames('chip', { chipError: !isConnected, chipSuccess: isConnected })}>
          {isConnected ? 'Connected' : 'Not connected'}
        </div>
      </div>
      <div>Lorem ipsum dolor sit amet consectetur adipisicing elit.</div>
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
      {isConnected ? (
        <Button
          className="alignSelfEnd"
          color="error"
          contentBefore={<LinkOffIcon />}
          onClick={handleDisconnect}
          variant="outlined"
        >
          Disconnect
        </Button>
      ) : (
        <Button className="alignSelfEnd" color="accent1" contentBefore={<LinkIcon />} onClick={formik.submitForm}>
          Connect
        </Button>
      )}
    </Card>
  );
};

export default NodeConnection;
