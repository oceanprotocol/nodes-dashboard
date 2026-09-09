import Card from '@/components/card/card';
import EscrowTokenPanel from '@/components/escrow/escrow-token-panel';
import LegacyEscrowBanner from '@/components/homepage/legacy-escrow-banner';
import Select from '@/components/input/select';
import { EscrowContractVersion, LEGACY_ESCROW_ADDRESS } from '@/constants/escrow';
import { useEscrowData } from '@/lib/use-escrow-data';
import { formatWalletAddress } from '@/utils/formatters';
import { CircularProgress } from '@mui/material';
import classNames from 'classnames';
import { useState } from 'react';
import styles from './escrow-manager.module.css';

const EscrowManager = () => {
  const [contractVersion, setContractVersion] = useState<EscrowContractVersion>('current');
  const isLegacy = contractVersion === 'legacy';
  const escrowAddress = isLegacy ? LEGACY_ESCROW_ADDRESS : undefined;
  const { tokens, spenders, loading, reload } = useEscrowData(escrowAddress);

  return (
    <>
      <LegacyEscrowBanner />
      {LEGACY_ESCROW_ADDRESS && (
        <Card direction="column" padding="sm" radius="lg" shadow="black" variant="glass-shaded">
          <div className={styles.contractSelector}>
            <Select<EscrowContractVersion>
              className={styles.contractSelect}
              label="Escrow contract"
              onChange={(e) => setContractVersion(e.target.value as EscrowContractVersion)}
              options={[
                { label: 'Current contract', value: 'current' },
                { label: `Legacy contract (${formatWalletAddress(LEGACY_ESCROW_ADDRESS)})`, value: 'legacy' },
              ]}
              value={contractVersion}
            />
            {isLegacy && <span className={classNames('chip chipGlass', styles.legacyChip)}>Withdraw only</span>}
          </div>
          {isLegacy ? (
            <div className={styles.hint}>
              <strong>Viewing the previous escrow deployment.</strong>
              <br />
              You can withdraw your funds; deposits and authorization changes are disabled.
            </div>
          ) : undefined}
        </Card>
      )}
      {loading && tokens.length === 0 ? (
        <CircularProgress className="alignSelfCenter" />
      ) : (
        <div className={styles.panels}>
          {tokens.map((token) => {
            const tokenSpenders = spenders.filter((s) => s.tokenAddress.toLowerCase() === token.address.toLowerCase());
            return (
              <EscrowTokenPanel
                escrowAddress={escrowAddress}
                key={token.address}
                loadingSpenders={loading}
                onChange={reload}
                spenders={tokenSpenders}
                token={token}
              />
            );
          })}
        </div>
      )}
    </>
  );
};

export default EscrowManager;
