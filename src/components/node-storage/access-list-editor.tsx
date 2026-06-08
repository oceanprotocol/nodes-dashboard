'use client';

import Button from '@/components/button/button';
import Input from '@/components/input/input';
import { CHAIN_ID } from '@/constants/chains';
import { formatChainLabel } from '@/utils/formatters';
import classNames from 'classnames';
import { isAddress } from 'ethers';
import React, { useState } from 'react';
import styles from './access-list-editor.module.css';

type AccessListEditorProps = {
  currentAccount?: string;
  error?: string;
  loading?: boolean;
  /** Called with just the wallet being added */
  onAdd?: (wallet: string) => void;
  /** Called with the full updated list */
  onChange?: (wallets: string[]) => void;
  /** Called with just the wallet being removed */
  onRemove?: (wallet: string) => void;
  wallets: string[];
};

const AccessListEditor: React.FC<AccessListEditorProps> = ({
  currentAccount,
  error,
  loading,
  onAdd,
  onChange,
  onRemove,
  wallets,
}) => {
  const [newWallet, setNewWallet] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);

  function handleAdd() {
    const trimmed = newWallet.trim();
    if (!trimmed) {
      return;
    }
    if (!isAddress(trimmed)) {
      setInputError('Invalid Ethereum address');
      return;
    }
    if (wallets.some((w) => w.toLowerCase() === trimmed.toLowerCase())) {
      setInputError('Address already in list');
      return;
    }
    setInputError(null);
    onAdd?.(trimmed);
    onChange?.([...wallets, trimmed]);
    setNewWallet('');
  }

  function handleRemove(wallet: string) {
    onRemove?.(wallet);
    onChange?.(wallets.filter((w) => w !== wallet));
  }

  return (
    <div className={styles.walletEditor}>
      {wallets.length > 0 && (
        <div className={styles.walletList}>
          {wallets.map((wallet) => {
            const isYou = currentAccount && wallet.toLowerCase() === currentAccount.toLowerCase();
            return (
              <React.Fragment key={wallet}>
                <span className={styles.walletAddress}>{wallet}</span>
                {isYou ? (
                  <span className={classNames('chip chipPrimaryOutlined', styles.walletYou)}>you</span>
                ) : (
                  <Button
                    color="accent1"
                    disabled={loading}
                    onClick={() => handleRemove(wallet)}
                    size="link"
                    variant="transparent"
                  >
                    Remove
                  </Button>
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}
      {error && wallets.length === 0 ? <span className="textError">{error}</span> : null}
      <div className={styles.addRow}>
        <Input
          disabled={loading}
          errorText={inputError ?? undefined}
          hint={inputError ? undefined : `Chain: ${formatChainLabel(CHAIN_ID)}`}
          label="Wallet to add"
          onChange={(e) => {
            setNewWallet(e.target.value);
            setInputError(null);
          }}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder="0x..."
          size="sm"
          type="text"
          value={newWallet}
        />
        <Button color="accent1" loading={loading} size="md" onClick={handleAdd}>
          {loading ? 'Saving...' : 'Add'}
        </Button>
      </div>
    </div>
  );
};

export default AccessListEditor;
