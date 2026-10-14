import SubsidyHistory from '@/components/account/subsidy-history';
import Button from '@/components/button/button';
import Card from '@/components/card/card';
import ProgressBar from '@/components/progress-bar/progress-bar';
import { formatSubsidyAmount, formatSubsidyTokenAmount } from '@/components/subsidy/subsidy-copy';
import SubsidyInfoButton from '@/components/subsidy/subsidy-info-button';
import SubsidyTiles from '@/components/subsidy/subsidy-tiles';
import { CHAIN_ID, CHAIN_LABELS } from '@/constants/chains';
import { SUBSIDY_TOKEN_SYMBOL } from '@/constants/subsidy';
import { useProfileContext } from '@/context/profile-context';
import {
  formatSubsidyPeriod,
  formatSubsidyReset,
  getBindingWindow,
  SubsidyAllowance,
  SubsidyWindow,
} from '@/lib/subsidy';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { useSubsidyProgram, useSubsidyUsage } from '@/lib/use-subsidy';
import { SubsidyStatus } from '@/types/subsidy';
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
  caption: ReactNode;
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
      <span className={styles.muted}>of {formatSubsidyTokenAmount(allowance.limit)} left</span>
    </div>
    <ProgressBar value={allowance.limit > 0 ? (allowance.remaining / allowance.limit) * 100 : 0} />
    <span className={styles.small}>{caption}</span>
  </Card>
);

const otherWindowsCaption = (windows: SubsidyWindow[], binding: SubsidyWindow) =>
  windows
    .filter((window) => window !== binding && !window.unlimited)
    .map(
      (window) =>
        `${formatSubsidyAmount(window.remaining)} of ${formatSubsidyTokenAmount(window.limit)} left this ${formatSubsidyPeriod(window.periodSeconds)}`
    )
    .join(' · ');

const ActiveSubsidy = ({ walletAddress }: { walletAddress: string }) => {
  const { data: program, isLoading: isProgramLoading } = useSubsidyProgram();
  const { data: usage, isLoading: isUsageLoading } = useSubsidyUsage();

  if (isProgramLoading || isUsageLoading) {
    return <CircularProgress className="alignSelfCenter" />;
  }

  const discountWindow = usage?.discount ? getBindingWindow(usage.discount.windows) : null;

  const chip = !usage ? null : usage.paused ? (
    <span className="chip chipError">Unavailable</span>
  ) : !usage.userAllowed ? (
    <span className="chip chipWarning">Not active yet</span>
  ) : (
    <span className="chip chipSuccess">Active</span>
  );

  return (
    <>
      <SubsidyHeader
        chip={chip}
        subtitle={
          <>
            Wallet <span className={styles.mono}>{formatWalletAddress(walletAddress)}</span> · {SUBSIDY_TOKEN_SYMBOL} on{' '}
            {CHAIN_LABELS[CHAIN_ID]}
          </>
        }
      />
      {!program || !usage ? (
        <span className={styles.small}>The subsidy isn&apos;t available on this network right now.</span>
      ) : (
        <>
          {!usage.userAllowed ? (
            <span className={styles.small}>
              Your wallet isn&apos;t on the subsidy list yet. Jobs and models are charged in full until it is.
            </span>
          ) : null}
          <div className={styles.grid}>
            {program.discount && usage.discount && discountWindow ? (
              <AllowanceCard
                allowance={discountWindow}
                caption={
                  otherWindowsCaption(usage.discount.windows, discountWindow) ||
                  `${formatSubsidyTokenAmount(discountWindow.used)} used this ${formatSubsidyPeriod(discountWindow.periodSeconds)}`
                }
                highlighted
                meta={discountWindow.resetsAt ? `Resets ${formatSubsidyReset(discountWindow.resetsAt)}` : ''}
                title={`${formatSubsidyAmount(program.discount.percent)}% off this ${formatSubsidyPeriod(discountWindow.periodSeconds)}`}
              />
            ) : null}
            {program.oneTime && usage.oneTime ? (
              <AllowanceCard
                allowance={usage.oneTime}
                caption={`${formatSubsidyTokenAmount(usage.oneTime.used)} used`}
                meta="One time"
                title={`${formatSubsidyTokenAmount(usage.oneTime.limit)} on us`}
              />
            ) : null}
          </div>
          <span className={styles.small}>
            Paid up front when each job starts, so it never needs to be in your escrow
          </span>
        </>
      )}
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
  const { subsidyInfo } = useProfileContext();
  const { data: usage, isLoading: isUsageLoading } = useSubsidyUsage();
  // The access list decides who gets the subsidy; the sign-up progress covers everyone else.
  const isActive = !!usage?.userAllowed || subsidyInfo?.status === SubsidyStatus.CLAIMED;

  const renderContent = () => {
    if (!subsidyInfo || isUsageLoading) {
      return <CircularProgress className="alignSelfCenter" />;
    }

    if (isActive) {
      return <ActiveSubsidy walletAddress={account.address ?? ''} />;
    }

    const appliedOn = subsidyInfo.applicationDate ? dayjs(subsidyInfo.applicationDate).format('MMM D, YYYY') : null;

    if (subsidyInfo.status === SubsidyStatus.PENDING) {
      return (
        <>
          <SubsidyHeader
            action={
              <Button color="accent1" href="/subsidy/verify" size="md">
                Verify email
              </Button>
            }
            chip={<span className="chip chipWarning">Email not verified</span>}
            subtitle={[appliedOn ? `Applied ${appliedOn}` : null, subsidyInfo.maskedEmail].filter(Boolean).join(' · ')}
          />
          <PendingSteps />
          <SubsidyTiles muted />
          <span className={styles.small}>
            Enter the code we emailed you to claim your subsidy. Until then, jobs and models are charged in full.
          </span>
        </>
      );
    }

    if (subsidyInfo.status === SubsidyStatus.EMAIL_VERIFIED) {
      return (
        <>
          <SubsidyHeader
            chip={<span className="chip chipSuccess">Verified</span>}
            subtitle={
              <>
                Wallet <span className={styles.mono}>{formatWalletAddress(account.address ?? '')}</span> ·{' '}
                {subsidyInfo.verifiedDate
                  ? `verified ${dayjs(subsidyInfo.verifiedDate).format('MMM D, YYYY')}`
                  : 'email verified'}
              </>
            }
          />
          <SubsidyTiles />
          <div className={styles.footer}>
            <span className={styles.small}>
              Claim to add your wallet to the subsidy contract and start using your subsidy.
            </span>
            <Button color="accent1" href="/subsidy/claim" size="md">
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
          <Button color="accent1" href="/subsidy/details" size="md">
            Get a subsidy
          </Button>
        </div>
      </>
    );
  };

  return (
    <>
      <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
        {renderContent()}
      </Card>
      {usage?.userAllowed ? <SubsidyHistory /> : null}
    </>
  );
};

export default SubsidySection;
