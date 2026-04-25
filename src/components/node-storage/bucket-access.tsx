'use client';

import Card from '@/components/card/card';
import Checkbox from '@/components/checkbox/checkbox';
import Input from '@/components/input/input';
import AccessListEditor from '@/components/node-storage/access-list-editor';
import { CHAIN_ID } from '@/constants/chains';
import { BucketAccessState, BucketAccessStateType } from '@/types/node-storage';
import { formatChainLabel } from '@/utils/formatters';
import { Collapse } from '@mui/material';
import classNames from 'classnames';
import React from 'react';
import { TransitionGroup } from 'react-transition-group';
import styles from './bucket-access.module.css';

type BucketAccessProps = {
  value: BucketAccessState;
  onChange: (value: BucketAccessState) => void;
  currentAccount?: string;
  error?: string;
};

const BucketAccess: React.FC<BucketAccessProps> = ({ value, onChange, currentAccount, error }) => {
  function handleModeChange(mode: BucketAccessStateType) {
    if (mode === 'existing') {
      onChange({ mode: 'existing', address: '' });
    } else {
      onChange({ mode: 'new', wallets: currentAccount ? [currentAccount] : [] });
    }
  }

  return (
    <div className={styles.section}>
      <span className={styles.sectionTitle}>Access list</span>

      {/* New access list */}
      <Card className={styles.option} direction="column" padding="sm" radius="sm" variant="glass">
        <Checkbox
          checked={value.mode === 'new'}
          className="alignSelfStart"
          label="New access list"
          onChange={() => handleModeChange('new')}
          type="single"
        />
        <div className={classNames(styles.optionContent, styles.optionDesc)}>
          Deploy a new access list contract with allowed wallet addresses
        </div>
        <TransitionGroup className={styles.optionContent}>
          {value.mode === 'new' ? (
            <Collapse>
              <div className={styles.optionExtra}>
                <AccessListEditor
                  currentAccount={currentAccount}
                  error={error}
                  onChange={(wallets) => onChange({ mode: 'new', wallets })}
                  wallets={value.wallets}
                />
              </div>
            </Collapse>
          ) : null}
        </TransitionGroup>
      </Card>

      {/* Existing access list */}
      <Card className={styles.option} direction="column" padding="sm" radius="sm" variant="glass">
        <Checkbox
          checked={value.mode === 'existing'}
          className="alignSelfStart"
          label="Existing access list"
          onChange={() => handleModeChange('existing')}
          type="single"
        />
        <div className={classNames(styles.optionContent, styles.optionDesc)}>
          Use an already deployed access list contract
        </div>
        <TransitionGroup className={styles.optionContent}>
          {value.mode === 'existing' ? (
            <Collapse>
              <div className={styles.optionExtra}>
                <Input
                  hint={`Chain: ${formatChainLabel(CHAIN_ID)}`}
                  errorText={error}
                  label="Access list contract address"
                  onChange={(e) => onChange({ mode: 'existing', address: e.target.value })}
                  placeholder="0x..."
                  size="sm"
                  type="text"
                  value={value.address}
                />
              </div>
            </Collapse>
          ) : null}
        </TransitionGroup>
      </Card>
    </div>
  );
};

export default BucketAccess;
