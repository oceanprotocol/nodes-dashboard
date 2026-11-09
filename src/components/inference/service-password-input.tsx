import CopyButton from '@/components/button/copy-button';
import Input from '@/components/input/input';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import styles from './service-password-input.module.css';

type ServicePasswordInputProps = {
  errorText?: string;
  label: React.ReactNode;
  name: string;
  onChange: (value: string) => void;
  value: string;
};

// Always visible: the dashboard does not keep the password, so this is the user's one chance to copy it.
const ServicePasswordInput: React.FC<ServicePasswordInputProps> = ({ errorText, label, name, onChange, value }) => {
  return (
    <div className="ph-no-capture">
      <Input
        endAdornment={<CopyButton contentToCopy={value} size="sm" variant="outlined" />}
        errorText={errorText}
        label={label}
        name={name}
        onChange={(e) => onChange(e.target.value)}
        size="md"
        type="text"
        value={value}
      />
      <div className={styles.notice}>
        <WarningAmberOutlinedIcon fontSize="small" />
        <div>
          <strong>Copy this password now and keep it safe.</strong>
          You need it to open the app and to call its API. The dashboard does not keep it and cannot show it again.
        </div>
      </div>
    </div>
  );
};

export default ServicePasswordInput;
