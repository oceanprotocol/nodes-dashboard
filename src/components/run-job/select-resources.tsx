import Button from '@/components/button/button';
import Card from '@/components/card/card';
import Input from '@/components/input/input';
import Select from '@/components/input/select';
import VideoCardLabel from '@/components/video-card-label/video-card-label';
import { MOCK_ENV } from '@/mock/environments';
import { useState } from 'react';
import styles from './select-resources.module.css';

// TODO replace mock data

const SelectResources = () => {
  const [token, setToken] = useState(MOCK_ENV.supportedTokens[0]);

  return (
    <Card direction="column" padding="md" radius="lg" spacing="md" variant="glass-shaded">
      <h3>Select resources</h3>
      <form className={styles.form}>
        <div className={styles.selectRow}>
          <Select
            label="GPU"
            multiple
            options={MOCK_ENV.gpu.map((gpu) => ({ label: gpu.name, value: gpu.name }))}
            renderOption={(option) => <VideoCardLabel card={option.label} />}
            renderSelectedValue={(option) => <VideoCardLabel card={option} />}
          />
          <Select
            label="Pricing token"
            onChange={(e) => setToken(e.target.value)}
            options={MOCK_ENV.supportedTokens.map((token) => ({ label: token, value: token }))}
            value={token}
          />
        </div>
        <div className={styles.inputsGrid}>
          <Input
            endAdornment="seconds"
            hint={`${MOCK_ENV.minPricePerMinute[token]} ${token}/min`}
            label="Job duration"
            type="number"
          />
          <Input
            endAdornment="cores"
            hint={`${MOCK_ENV.cpu.unitPrice[token]} ${token}/core`}
            label="CPU cores"
            topRight={`${1}-${MOCK_ENV.cpu.max}`}
            type="number"
          />
          <Input
            endAdornment="GB"
            hint={`${MOCK_ENV.ram.unitPrice[token]} ${token}/GB`}
            label="RAM capacity"
            topRight={`${1}-${MOCK_ENV.ram.max}`}
            type="number"
          />
          <Input
            endAdornment="GB"
            hint={`${MOCK_ENV.disk.unitPrice[token]} ${token}/GB`}
            label="Disk space"
            topRight={`${0}-${MOCK_ENV.disk.max}`}
            type="number"
          />
        </div>
        <Card className={styles.cost} variant="accent1-outline" radius="md">
          <h3>Estimated total cost</h3>
          <div className={styles.values}>
            <div>
              <span className={styles.token}>{token}</span>
              &nbsp;
              <span className={styles.amount}>{MOCK_ENV.minPricePerMinute[token]}</span>
            </div>
            <div className={styles.reimbursment}>If the job is shorter, you will get your tokens back</div>
          </div>
        </Card>
        <Button className={styles.button} color="accent2" href={`/run-job/payment`} size="lg">
          Continue
        </Button>
      </form>
    </Card>
  );
};

export default SelectResources;
