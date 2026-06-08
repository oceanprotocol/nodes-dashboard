import Button from '@/components/button/button';
import Input from '@/components/input/input';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Collapse } from '@mui/material';
import classNames from 'classnames';
import { isAddress } from 'ethers';
import { useState } from 'react';
import styles from './access-editor.module.css';
import commonStyles from './node-config.module.css';

type AccessEditorProps = {
  accessListAddresses: string[];
  disabled?: boolean;
  onAccessListAddressesChange: (addresses: string[]) => void;
  onWalletAddressesChange: (addresses: string[]) => void;
  title: string;
  walletAddresses: string[];
};

const AccessEditor: React.FC<AccessEditorProps> = ({
  accessListAddresses,
  disabled,
  onAccessListAddressesChange,
  onWalletAddressesChange,
  title,
  walletAddresses,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [newWallet, setNewWallet] = useState('');
  const [walletError, setWalletError] = useState<string | null>(null);
  const [newContract, setNewContract] = useState('');
  const [contractError, setContractError] = useState<string | null>(null);

  const handleAddWallet = () => {
    const trimmed = newWallet.trim();
    if (!trimmed) return;
    if (!isAddress(trimmed)) {
      setWalletError('Invalid Ethereum address');
      return;
    }
    if (walletAddresses.some((a) => a.toLowerCase() === trimmed.toLowerCase())) {
      setWalletError('Address already in list');
      return;
    }
    setWalletError(null);
    onWalletAddressesChange([...walletAddresses, trimmed]);
    setNewWallet('');
  };

  const handleRemoveWallet = (address: string) => {
    onWalletAddressesChange(walletAddresses.filter((a) => a.toLowerCase() !== address.toLowerCase()));
  };

  const handleAddContract = () => {
    const trimmed = newContract.trim();
    if (!trimmed) return;
    if (!isAddress(trimmed)) {
      setContractError('Invalid Ethereum address');
      return;
    }
    if (accessListAddresses.some((a) => a.toLowerCase() === trimmed.toLowerCase())) {
      setContractError('Contract already in list');
      return;
    }
    setContractError(null);
    onAccessListAddressesChange([...accessListAddresses, trimmed]);
    setNewContract('');
  };

  const handleRemoveContract = (address: string) => {
    onAccessListAddressesChange(accessListAddresses.filter((a) => a.toLowerCase() !== address.toLowerCase()));
  };

  return (
    <div>
      <div className={styles.accessHeader} onClick={() => setIsOpen((o) => !o)}>
        <div className={styles.accessTitle}>
          <span>{title}</span>
          <ExpandMoreIcon className={classNames(styles.icon, { [styles.iconOpen]: isOpen })} />
        </div>
        <div className={styles.accessChips}>
          <span className="chip chipGlass">{walletAddresses.length} wallets</span>
          <span className="chip chipGlass">{accessListAddresses.length} access lists</span>
        </div>
      </div>
      <Collapse in={isOpen}>
        <div className={styles.accessEditor}>
          <h4 className={commonStyles.subsectionTitle}>Wallet addresses</h4>
          {walletAddresses.length === 0 ? (
            <span className="textSecondary">No wallet addresses. Open to all.</span>
          ) : (
            <div className={commonStyles.addressList}>
              {walletAddresses.map((addr) => (
                <div className={commonStyles.addressRow} key={addr}>
                  <span className={commonStyles.addressText}>{addr}</span>
                  {!disabled ? (
                    <Button color="error" onClick={() => handleRemoveWallet(addr)} size="sm" type="button" variant="transparent">
                      Remove
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
          {!disabled ? (
            <div className={commonStyles.addressAddRow}>
              <Input
                errorText={walletError ?? undefined}
                label="Add wallet address"
                onChange={(e) => {
                  setNewWallet(e.target.value);
                  setWalletError(null);
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleAddWallet()}
                placeholder="0x..."
                size="sm"
                type="text"
                value={newWallet}
              />
              <Button color="accent1" onClick={handleAddWallet} size="md" type="button" variant="filled">
                Add
              </Button>
            </div>
          ) : null}

          <h4 className={commonStyles.subsectionTitle}>Access list contracts</h4>
          {accessListAddresses.length === 0 ? (
            <span className="textSecondary">No access list contracts. Open to all.</span>
          ) : (
            <div className={commonStyles.addressList}>
              {accessListAddresses.map((addr) => (
                <div className={commonStyles.addressRow} key={addr}>
                  <span className={commonStyles.addressText}>{addr}</span>
                  {!disabled ? (
                    <Button color="error" onClick={() => handleRemoveContract(addr)} size="sm" type="button" variant="transparent">
                      Remove
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
          {!disabled ? (
            <div className={commonStyles.addressAddRow}>
              <Input
                errorText={contractError ?? undefined}
                label="Add access list contract"
                onChange={(e) => {
                  setNewContract(e.target.value);
                  setContractError(null);
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleAddContract()}
                placeholder="0x..."
                size="sm"
                type="text"
                value={newContract}
              />
              <Button color="accent1" onClick={handleAddContract} size="md" type="button" variant="filled">
                Add
              </Button>
            </div>
          ) : null}
        </div>
      </Collapse>
    </div>
  );
};

export default AccessEditor;
