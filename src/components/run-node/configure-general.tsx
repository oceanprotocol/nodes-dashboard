import Button from '@/components/button/button';
import Input from '@/components/input/input';
import Switch from '@/components/switch/switch';
import { NodeConfig } from '@/types/node-config';
import CloseIcon from '@mui/icons-material/Close';
import { ethers } from 'ethers';
import React, { useState } from 'react';
import { toast } from 'react-toastify';
import styles from './configure-general.module.css';
import commonStyles from './configure-page.module.css';

type ConfigureGeneralProps = {
  config: NodeConfig;
  setConfig: (config: NodeConfig) => void;
};

const ConfigureGeneral: React.FC<ConfigureGeneralProps> = ({ config, setConfig }) => {
  const [adminToAdd, setAdminToAdd] = useState('');

  const admins = config.allowedAdmins ?? [];

  const handleAddAdmin = () => {
    const trimmed = adminToAdd.trim();
    if (!trimmed || admins.includes(trimmed)) {
      return;
    }
    if (!ethers.isAddress(trimmed)) {
      toast.error('Invalid wallet address');
      return;
    }
    setConfig({ ...config, allowedAdmins: [...admins, trimmed] });
    setAdminToAdd('');
  };

  const handleRemoveAdmin = (address: string) => {
    setConfig({ ...config, allowedAdmins: admins.filter((a) => a !== address) });
  };

  const handleHasHttpChange = (_e: unknown, checked: boolean) => {
    setConfig({ ...config, hasHttp: checked });
  };

  const handleHttpPortChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const port = e.target.value === '' ? undefined : Number(e.target.value);
    setConfig({ ...config, httpPort: port });
  };

  return (
    <div className={commonStyles.sectionContent}>
      <div className={styles.adminsSection}>
        <h4 className={commonStyles.subsectionTitle}>Allowed admins</h4>
        <div className={styles.adminsList}>
          {admins.map((address) => (
            <React.Fragment key={address}>
              <span className="wordBreakAll">{address}</span>
              <Button onClick={() => handleRemoveAdmin(address)} size="link" type="button" variant="transparent">
                <CloseIcon className="textAccent1" fontSize="small" />
              </Button>
            </React.Fragment>
          ))}
        </div>
        <div className={styles.addAdminRow}>
          <Input
            className={styles.addAdminInput}
            name="adminToAdd"
            onChange={(e) => setAdminToAdd(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleAddAdmin();
              }
            }}
            placeholder="0x..."
            size="sm"
            type="text"
            value={adminToAdd}
          />
          <Button color="accent1" onClick={handleAddAdmin} size="md" variant="filled">
            Add
          </Button>
        </div>
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
