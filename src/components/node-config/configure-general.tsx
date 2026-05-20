import Card from '@/components/card/card';
import DurationInput from '@/components/input/duration-input';
import Input from '@/components/input/input';
import Switch from '@/components/switch/switch';
import { NodeConfig } from '@/types/node-config';
import { DURATION_UNIT_OPTIONS } from '@/utils/duration';
import React from 'react';
import AccessEditor from './access-editor';
import styles from './configure-general.module.css';
import commonStyles from './node-config.module.css';

type ConfigureGeneralProps = {
  config: NodeConfig;
  setConfig: (config: NodeConfig) => void;
};

const ConfigureGeneral: React.FC<ConfigureGeneralProps> = ({ config, setConfig }) => {
  const handleHasHttpChange = (_e: unknown, checked: boolean) => {
    setConfig({ ...config, hasHttp: checked });
  };

  const handleHttpPortChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const port = e.target.value === '' ? undefined : Number(e.target.value);
    setConfig({ ...config, httpPort: port });
  };

  return (
    <div className={commonStyles.sectionContent}>
      <Card innerShadow="black" padding="sm" radius="sm" variant="glass">
        <AccessEditor
          accessListAddresses={config.allowedAdminsList ?? []}
          onAccessListAddressesChange={(addresses) => setConfig({ ...config, allowedAdminsList: addresses })}
          onWalletAddressesChange={(addresses) => setConfig({ ...config, allowedAdmins: addresses })}
          title="Allowed admins"
          walletAddresses={config.allowedAdmins ?? []}
        />
      </Card>
      <h4 className={commonStyles.subsectionTitle}>Storage</h4>
      <Switch
        checked={!!config.persistentStorage?.enabled}
        className="alignSelfStart"
        label="Enable persistent storage"
        onChange={(_, checked) =>
          setConfig({ ...config, persistentStorage: { ...(config.persistentStorage ?? {}), enabled: checked } })
        }
      />
      <h4 className={commonStyles.subsectionTitle}>Payment claiming</h4>
      <div className={styles.toggleRow}>
        <DurationInput
          availableUnits={DURATION_UNIT_OPTIONS}
          defaultUnit="hours"
          hint="Escrow grace period after job ends"
          label="Claim timeout"
          onChange={(seconds) => setConfig({ ...config, claimDurationTimeout: seconds })}
          size="sm"
          value={config.claimDurationTimeout ?? 3600}
        />
        <DurationInput
          availableUnits={DURATION_UNIT_OPTIONS}
          defaultUnit="hours"
          hint="How often to attempt payment claims"
          label="Claim interval"
          onChange={(seconds) => setConfig({ ...config, paymentClaimInterval: seconds })}
          size="sm"
          value={config.paymentClaimInterval ?? 3600}
        />
      </div>
      <h4 className={commonStyles.subsectionTitle}>HTTP</h4>
      <div className={styles.toggleRow}>
        <Switch checked={!!config.hasHttp} label="Enable HTTP" name="hasHttp" onChange={handleHasHttpChange} />
        <Input
          disabled={!config.hasHttp}
          name="httpPort"
          onChange={handleHttpPortChange}
          placeholder="Port"
          size="sm"
          startAdornment="Port"
          type="number"
          value={config.httpPort ?? ''}
        />
      </div>
    </div>
  );
};

export default ConfigureGeneral;
