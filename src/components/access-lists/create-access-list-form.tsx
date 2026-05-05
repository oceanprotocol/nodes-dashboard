'use client';

import Button from '@/components/button/button';
import Input from '@/components/input/input';
import { CHAIN_ID } from '@/constants/chains';
import { useAccessList } from '@/lib/use-access-list';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { formatChainLabel, formatError } from '@/utils/formatters';
import classNames from 'classnames';
import { isAddress } from 'ethers';
import { useState } from 'react';
import { toast } from 'react-toastify';
import styles from './access-lists-page.module.css';

type CreateAccessListFormProps = {
  onCreated: (contractAddress: string) => void;
};

const CreateAccessListForm: React.FC<CreateAccessListFormProps> = ({ onCreated }) => {
  const { account } = useOceanAccount();
  const { deployNewAccessList } = useAccessList();

  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [seedWallet, setSeedWallet] = useState('');
  const [seedWallets, setSeedWallets] = useState<string[]>([]);
  const [seedError, setSeedError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [symbolError, setSymbolError] = useState<string | null>(null);
  const [deploying, setDeploying] = useState(false);

  function handleAddSeed() {
    const trimmed = seedWallet.trim();
    if (!trimmed) return;
    if (!isAddress(trimmed)) {
      setSeedError('Invalid Ethereum address');
      return;
    }
    if (seedWallets.some((w) => w.toLowerCase() === trimmed.toLowerCase())) {
      setSeedError('Address already added');
      return;
    }
    setSeedError(null);
    setSeedWallets((prev) => [...prev, trimmed]);
    setSeedWallet('');
  }

  function handleRemoveSeed(wallet: string) {
    setSeedWallets((prev) => prev.filter((w) => w !== wallet));
  }

  async function handleDeploy() {
    if (!account.address) {
      toast.error('Wallet not connected.');
      return;
    }
    let valid = true;
    if (!name.trim()) {
      setNameError('Name required');
      valid = false;
    }
    if (!symbol.trim()) {
      setSymbolError('Symbol required');
      valid = false;
    }
    if (!valid) return;
    setDeploying(true);
    try {
      const creator = account.address;
      const wallets = seedWallets.some((w) => w.toLowerCase() === creator.toLowerCase())
        ? seedWallets
        : [creator, ...seedWallets];
      const address = await deployNewAccessList({
        name: name.trim(),
        symbol: symbol.trim(),
        owner: creator,
        wallets,
      });
      toast.success(`Access list deployed at ${address}`);
      setName('');
      setSymbol('');
      setSeedWallets([]);
      setSeedWallet('');
      onCreated(address);
    } catch (e: any) {
      toast.error(formatError({ error: e, fallback: 'Failed to deploy access list.' }));
    } finally {
      setDeploying(false);
    }
  }

  return (
    <div className="flexColumn gapSm">
      <span className={styles.empty}>Chain: {formatChainLabel(CHAIN_ID)}</span>
      <div className={styles.formRow}>
        <Input
          disabled={deploying}
          errorText={nameError ?? undefined}
          label="Name"
          onChange={(e) => {
            setName(e.target.value);
            setNameError(null);
          }}
          placeholder="My access list"
          size="sm"
          type="text"
          value={name}
        />
        <Input
          disabled={deploying}
          errorText={symbolError ?? undefined}
          label="Symbol"
          onChange={(e) => {
            setSymbol(e.target.value);
            setSymbolError(null);
          }}
          placeholder="MAL"
          size="sm"
          type="text"
          value={symbol}
        />
      </div>
      <strong>Initial members</strong>
      <span className={styles.empty}>Your wallet is added automatically so the list is discoverable.</span>
      {seedWallets.length > 0 ? (
        <div>
          {seedWallets.map((wallet) => (
            <div className={styles.memberRow} key={wallet}>
              <span className={styles.memberAddress}>{wallet}</span>
              <Button
                color="accent1"
                disabled={deploying}
                onClick={() => handleRemoveSeed(wallet)}
                size="link"
                variant="transparent"
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <span className={styles.empty}>No members added yet.</span>
      )}
      <div className={classNames(styles.lookupRow)}>
        <Input
          disabled={deploying}
          errorText={seedError ?? undefined}
          label="Wallet to add"
          onChange={(e) => {
            setSeedWallet(e.target.value);
            setSeedError(null);
          }}
          onKeyDown={(e) => e.key === 'Enter' && handleAddSeed()}
          placeholder="0x..."
          size="sm"
          type="text"
          value={seedWallet}
        />
        <Button color="accent1" disabled={deploying} size="md" variant="outlined" onClick={handleAddSeed}>
          Add
        </Button>
      </div>
      <div className="actionsGroupMdEnd">
        <Button color="accent1" loading={deploying} size="md" onClick={handleDeploy}>
          Deploy access list
        </Button>
      </div>
    </div>
  );
};

export default CreateAccessListForm;
