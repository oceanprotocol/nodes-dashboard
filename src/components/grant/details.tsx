import Button from '@/components/button/button';
import Card from '@/components/card/card';
import Checkbox from '@/components/checkbox/checkbox';
import Input from '@/components/input/input';
import classNames from 'classnames';
import { useFormik } from 'formik';
import { useRouter } from 'next/router';
import * as Yup from 'yup';
import styles from './details.module.css';

type DetailsFormValues = {
  email: string;
  goal: string | null;
  handle: string;
  hardware: string[];
  name: string;
  os: string | null;
  role: string | null;
  walletAddress: string;
};

const ROLE_CHOICES = [
  { label: 'AI developer', value: 'ai_developer' },
  { label: 'Data scientist', value: 'data_scientist' },
  { label: 'Student/ Researcher', value: 'student_researcher' },
  { label: 'Node operator/ Miner', value: 'node_operator' },
  { label: 'Web3 builder/ Founder', value: 'web3_builder' },
  { label: 'Crypto investor/ Trader', value: 'crypto_investor' },
];

const HARDWARE_CHOICES = [
  { label: 'Ultra high-end gaming PC (NVIDIA GPU 4090/5090)', value: 'highend_gaming_pc' },
  { label: 'Lightweight gaming PC', value: 'lightweight_gaming_pc' },
  { label: 'Apple (MacBook M1 - M5)', value: 'apple' },
  { label: 'Enterprise/ Data center GPU (eg. H100/ A100)', value: 'enterprise_data_center_gpu' },
  { label: 'Standard laptop/ CPU only', value: 'standard_laptop_cpu_only' },
  { label: 'None/ Cloud resources only', value: 'none_cloud_resources_only' },
];

const OS_CHOICES = [
  { label: 'Windows', value: 'windows' },
  { label: 'MacOS', value: 'macos' },
  { label: 'Linux', value: 'linux' },
];

const GOAL_CHOICES = [
  {
    description: 'I need affordable compute to train or fine-tune my own models',
    label: 'Train AI models',
    value: 'train_ai_models',
  },
  {
    description: 'I want to run autonomous bots for trading, predictions, or automation',
    label: 'Deploy AI agents',
    value: 'deploy_ai_agents',
  },
  {
    description: 'I am a developer building an App that would benefit from an out-of-the-box decentralized AI backend',
    label: 'Build an application',
    value: 'build_an_application',
  },
  {
    description: 'I am conducting research and need privacy-preserving infrastructure',
    label: 'Academic/ Private research',
    value: 'academic_private_research',
  },
  {
    description: 'I want to earn revenue by renting out my GPU/CPU power',
    label: 'Monetize idle hardware',
    value: 'monetize_idle_hardware',
  },
];

const Details: React.FC = () => {
  const router = useRouter();

  const formik = useFormik<DetailsFormValues>({
    initialValues: {
      email: '',
      goal: null,
      handle: '',
      hardware: [],
      name: '',
      os: null,
      role: null,
      walletAddress: '',
    },
    onSubmit: (values) => {
      console.log(values);
      router.push('/grant/verify');
    },
    validationSchema: Yup.object({
      email: Yup.string().email('Invalid email').required('Required'),
      goal: Yup.string().required('Selection required'),
      handle: Yup.string().required('Required'),
      hardware: Yup.array().min(1, 'Selection required'),
      name: Yup.string().required('Required'),
      os: Yup.string().required('Selection required'),
      role: Yup.string().required('Selection required'),
      walletAddress: Yup.string().required('Required'),
    }),
  });

  return (
    <Card padding="md" radius="lg" variant="glass-shaded">
      <form className={styles.form} onSubmit={formik.handleSubmit}>
        <div className={styles.section}>
          <h3>User details</h3>
          <Input
            errorText={formik.touched.name && formik.errors.name ? formik.errors.name : undefined}
            label="Name"
            name="name"
            onBlur={formik.handleBlur}
            onChange={formik.handleChange}
            type="text"
            value={formik.values.name}
          />
          <Input
            errorText={formik.touched.email && formik.errors.email ? formik.errors.email : undefined}
            label="Email address"
            name="email"
            onBlur={formik.handleBlur}
            onChange={formik.handleChange}
            type="email"
            value={formik.values.email}
          />
          <Input
            errorText={
              formik.touched.walletAddress && formik.errors.walletAddress ? formik.errors.walletAddress : undefined
            }
            label="ERC-20 Wallet Address "
            name="walletAddress"
            onBlur={formik.handleBlur}
            onChange={formik.handleChange}
            type="text"
            value={formik.values.walletAddress}
          />
          <Input
            errorText={formik.touched.handle && formik.errors.handle ? formik.errors.handle : undefined}
            label="Discord or Telegram handle"
            name="handle"
            onBlur={formik.handleBlur}
            onChange={formik.handleChange}
            type="text"
            value={formik.values.handle}
          />
        </div>
        <div className={styles.section}>
          <div>
            <h3>Which role best describes you?</h3>
            {formik.touched.role && formik.errors.role ? <div className="textError">{formik.errors.role}</div> : null}
          </div>
          <div className={classNames(styles.choices, styles.choices3cols)}>
            {ROLE_CHOICES.map((choice) => (
              <Checkbox
                checked={formik.values.role === choice.value}
                key={choice.value}
                label={choice.label}
                name="role"
                onChange={formik.handleChange}
                type="single"
                value={choice.value}
              />
            ))}
          </div>
        </div>
        <div className={styles.section}>
          <div>
            <h3>What hardware do you currently have access to?</h3>
            {formik.touched.hardware && formik.errors.hardware ? (
              <div className="textError">{formik.errors.hardware}</div>
            ) : null}
          </div>
          <div className={classNames(styles.choices, styles.choices2cols)}>
            {HARDWARE_CHOICES.map((choice) => (
              <Checkbox
                checked={formik.values.hardware.includes(choice.value)}
                key={choice.value}
                label={choice.label}
                name="hardware"
                onChange={formik.handleChange}
                type="multiple"
                value={choice.value}
              />
            ))}
          </div>
        </div>
        <div className={styles.section}>
          <div>
            <h3>What is your preferred Operating System?</h3>
            {formik.touched.os && formik.errors.os ? <div className="textError">{formik.errors.os}</div> : null}
          </div>
          <div className={classNames(styles.choices, styles.choicesRow)}>
            {OS_CHOICES.map((choice) => (
              <Checkbox
                checked={formik.values.os === choice.value}
                key={choice.value}
                label={choice.label}
                name="os"
                onChange={formik.handleChange}
                type="single"
                value={choice.value}
              />
            ))}
          </div>
        </div>
        <div className={styles.section}>
          <div>
            <h3>What is your primary goal for this grant?</h3>
            {formik.touched.goal && formik.errors.goal ? <div className="textError">{formik.errors.goal}</div> : null}
          </div>
          <div className={styles.choices}>
            {GOAL_CHOICES.map((choice) => (
              <Checkbox
                checked={formik.values.goal === choice.value}
                key={choice.value}
                label={
                  <div>
                    <strong>{choice.label}:</strong>&nbsp;
                    {choice.description}
                  </div>
                }
                name="goal"
                onChange={formik.handleChange}
                type="single"
                value={choice.value}
              />
            ))}
          </div>
        </div>
        <Button className="alignSelfEnd" color="accent2" type="submit" size="lg" variant="filled">
          Continue
        </Button>
      </form>
    </Card>
  );
};

export default Details;
