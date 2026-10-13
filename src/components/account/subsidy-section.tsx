import Button from '@/components/button/button';
import Card from '@/components/card/card';
import SubsidyInfoButton from '@/components/grant/subsidy-info-button';
import SubsidyTiles from '@/components/grant/subsidy-tiles';
import ProgressBar from '@/components/progress-bar/progress-bar';
import { CHAIN_ID, CHAIN_LABELS } from '@/constants/chains';
import { SUBSIDY_DISCOUNT_PERCENT, SUBSIDY_TOKEN_SYMBOL } from '@/constants/subsidy';
import { useProfileContext } from '@/context/profile-context';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { formatSubsidyReset, SubsidyAllowance, useSubsidyUsage } from '@/lib/use-subsidy';
import { GrantStatus } from '@/types/grant';
import { formatWalletAddress } from '@/utils/formatters';
import CheckIcon from '@mui/icons-material/Check';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { CircularProgress } from '@mui/material';
import classNames from 'classnames';
import dayjs from 'dayjs';
import { ReactNode } from 'react';
import styles from './subsidy-section.module.css';

type SubsidyHeaderProps = {
  action?: ReactNode;
  chip?: ReactNode;
  subtitle: ReactNode;
};

const SubsidyHeader = ({ action, chip, subtitle }: SubsidyHeaderProps) => (
  <div className={styles.header}>
    <div className={styles.headerText}>
      <div className={styles.titleRow}>
        <h4>OPF subsidy</h4>
        {chip}
        <SubsidyInfoButton />
      </div>
      <span className={styles.muted}>{subtitle}</span>
    </div>
    {action}
  </div>
);

type AllowanceCardProps = {
  allowance: SubsidyAllowance;
  caption: string;
  highlighted?: boolean;
  meta: string;
  title: string;
};

const AllowanceCard = ({ allowance, caption, highlighted, meta, title }: AllowanceCardProps) => (
  <Card className={styles.allowance} radius="sm" variant={highlighted ? 'accent1-outline' : 'glass'}>
    <div className={styles.allowanceHeader}>
      <strong>{title}</strong>
      <span className={styles.small}>{meta}</span>
    </div>
    <div className={styles.allowanceValue}>
      <span className={styles.allowanceAmount}>{allowance.remaining.toFixed(2)}</span>
      <span className={styles.muted}>
        of {allowance.limit} {SUBSIDY_TOKEN_SYMBOL} left
      </span>
    </div>
    <ProgressBar value={allowance.limit > 0 ? (allowance.remaining / allowance.limit) * 100 : 0} />
    <span className={styles.small}>{caption}</span>
  </Card>
);

const ActiveSubsidy = ({ walletAddress }: { walletAddress: string }) => {
  const { data: usage, isLoading } = useSubsidyUsage();

  if (isLoading || !usage) {
    return <CircularProgress className="alignSelfCenter" />;
  }

  return (
    <>
      <SubsidyHeader
        chip={
          usage.paused ? (
            <span className="chip chipError">Unavailable</span>
          ) : (
            <span className="chip chipSuccess">Active</span>
          )
        }
        subtitle={
          <>
            Wallet <span className={styles.mono}>{formatWalletAddress(walletAddress)}</span> · {SUBSIDY_TOKEN_SYMBOL} on{' '}
            {CHAIN_LABELS[CHAIN_ID]}
          </>
        }
      />
      <div className={styles.grid}>
        <AllowanceCard
          allowance={usage.discount}
          caption={`${usage.discount.used.toFixed(2)} ${SUBSIDY_TOKEN_SYMBOL} used this week`}
          highlighted
          meta={`Resets ${formatSubsidyReset(usage.discount.resetsAt, 'short')}`}
          title={`${SUBSIDY_DISCOUNT_PERCENT}% discount this week`}
        />
        <AllowanceCard
          allowance={usage.oneTime}
          caption={`${usage.oneTime.used.toFixed(2)} ${SUBSIDY_TOKEN_SYMBOL} used`}
          meta="One time"
          title={`${usage.oneTime.limit} ${SUBSIDY_TOKEN_SYMBOL} on us`}
        />
      </div>
      <span className={styles.small}>Paid up front when each job starts, so it never needs to be in your escrow</span>
    </>
  );
};

const PendingSteps = () => (
  <div className={styles.steps}>
    <span className={classNames(styles.step, styles.stepComplete)}>
      <CheckIcon aria-label="Done" fontSize="small" />
      Submit
    </span>
    <span className={classNames(styles.step, styles.stepActive)}>
      <ErrorOutlineIcon aria-label="Action needed" fontSize="small" />
      Verify email
    </span>
    <span className={styles.step}>Claim</span>
  </div>
);

const SubsidySection = () => {
  const { account } = useOceanAccount();
  const { grantInfo } = useProfileContext();

  const renderContent = () => {
    if (!grantInfo) {
      return <CircularProgress className="alignSelfCenter" />;
    }

    if (grantInfo.status === GrantStatus.CLAIMED) {
      return <ActiveSubsidy walletAddress={account.address ?? ''} />;
    }

    const appliedOn = grantInfo.applicationDate ? dayjs(grantInfo.applicationDate).format('MMM D, YYYY') : null;

    if (grantInfo.status === GrantStatus.PENDING) {
      return (
        <>
          <SubsidyHeader
            action={
              <Button color="accent1" href="/grant/verify" size="md">
                Verify email
              </Button>
            }
            chip={<span className="chip chipWarning">Email not verified</span>}
            subtitle={[appliedOn ? `Applied ${appliedOn}` : null, grantInfo.maskedEmail].filter(Boolean).join(' · ')}
          />
          <PendingSteps />
          <SubsidyTiles muted />
          <span className={styles.small}>
            Enter the code we emailed you to claim your subsidy. Until then, jobs and models are charged in full.
          </span>
        </>
      );
    }

    if (grantInfo.status === GrantStatus.EMAIL_VERIFIED) {
      return (
        <>
          <SubsidyHeader
            chip={<span className="chip chipSuccess">Verified</span>}
            subtitle={
              <>
                Wallet <span className={styles.mono}>{formatWalletAddress(account.address ?? '')}</span> ·{' '}
                {grantInfo.verifiedDate
                  ? `verified ${dayjs(grantInfo.verifiedDate).format('MMM D, YYYY')}`
                  : 'email verified'}
              </>
            }
          />
          <SubsidyTiles />
          <div className={styles.footer}>
            <span className={styles.small}>
              Claim to add your wallet to the subsidy contract and start using your subsidy.
            </span>
            <Button color="accent1" href="/grant/claim" size="md">
              Claim subsidy
            </Button>
          </div>
        </>
      );
    }

    return (
      <>
        <SubsidyHeader subtitle="Verify your email to get it on jobs and models" />
        <SubsidyTiles />
        <div className={styles.footer}>
          <span className={styles.small}>Takes a minute: your details, then a 6-digit code.</span>
          <Button color="accent1" href="/grant/details" size="md">
            Get a subsidy
          </Button>
        </div>
      </>
    );
  };

  return (
    <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
      {renderContent()}
    </Card>
  );
};

export default SubsidySection;
