import Container from '@/components/container/container';
import EscrowTokenPanel from '@/components/escrow/escrow-token-panel';
import Select from '@/components/input/select';
import SectionTitle from '@/components/section-title/section-title';
import { EscrowContractVersion, LEGACY_ESCROW_ADDRESS } from '@/constants/escrow';
import { useEscrowData } from '@/lib/use-escrow-data';
import { formatWalletAddress } from '@/utils/formatters';
import { CircularProgress } from '@mui/material';
import classNames from 'classnames';
import { useState } from 'react';
import styles from './escrow-page.module.css';

const EscrowPage = () => {
  const [contractVersion, setContractVersion] = useState<EscrowContractVersion>('current');
  const isLegacy = contractVersion === 'legacy';
  const escrowAddress = isLegacy ? LEGACY_ESCROW_ADDRESS : undefined;
  const { tokens, spenders, loading, reload } = useEscrowData(escrowAddress);

  return (
    <Container className="pageRoot">
      <SectionTitle
        moreReadable
        title="Escrow management"
        subTitle="Deposit and withdraw escrow funds, and manage the spending authorizations used to pay for compute jobs."
      />
      <div className={classNames('pageContentWrapper', styles.content)}>
        {LEGACY_ESCROW_ADDRESS && (
          <div className={styles.contractSelector}>
            <Select<EscrowContractVersion>
              className={styles.contractSelect}
              hint={
                isLegacy
                  ? 'Viewing the previous escrow deployment. You can withdraw your funds; deposits and authorization changes are disabled.'
                  : undefined
              }
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
        )}
        {loading && tokens.length === 0 ? (
          <CircularProgress className="alignSelfCenter" />
        ) : (
          <div className={styles.panels}>
            {tokens.map((token) => {
              const tokenSpenders = spenders.filter(
                (s) => s.tokenAddress.toLowerCase() === token.address.toLowerCase()
              );
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
      </div>
    </Container>
  );
};

export default EscrowPage;
