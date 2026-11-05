import Button from '@/components/button/button';
import CopyButton from '@/components/button/copy-button';
import Input from '@/components/input/input';
import { useState } from 'react';

type ServicePasswordInputProps = {
  errorText?: string;
  label: React.ReactNode;
  name: string;
  onChange: (value: string) => void;
  value: string;
};

const ServicePasswordInput: React.FC<ServicePasswordInputProps> = ({ errorText, label, name, onChange, value }) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className="ph-no-capture">
      <Input
        endAdornment={
          <div className="flexRow gapSm">
            <Button color="accent1" onClick={() => setVisible((v) => !v)} size="sm" variant="outlined">
              {visible ? 'Hide' : 'Show'}
            </Button>
            <CopyButton contentToCopy={value} size="sm" variant="outlined" />
          </div>
        }
        errorText={errorText}
        label={label}
        name={name}
        onChange={(e) => onChange(e.target.value)}
        size="md"
        type={visible ? 'text' : 'password'}
        value={value}
      />
    </div>
  );
};

export default ServicePasswordInput;
