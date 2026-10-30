import CustomSubsidies from '@/components/account/custom-subsidies';
import { CreditBlock, DiscountBlock } from '@/components/account/subsidy-blocks';
import SubsidyHistory from '@/components/account/subsidy-history';
import Button from '@/components/button/button';
import Card from '@/components/card/card';
import FlowSteps, { FlowStep } from '@/components/flow-steps/flow-steps';
import { captureSubsidyCtaClick } from '@/components/subsidy/subsidy-analytics';
import { formatSubsidyAmount, formatSubsidyTokenAmount } from '@/components/subsidy/subsidy-copy';
import SubsidyInfoButton from '@/components/subsidy/subsidy-info-button';
import SubsidyStatusError from '@/components/subsidy/subsidy-status-error';
import SubsidyTiles from '@/components/subsidy/subsidy-tiles';
import toneStyles from '@/components/subsidy/subsidy-tone.module.css';
import { USDC } from '@/constants/tokens';
import { useProfileContext } from '@/context/profile-context';
import { getBindingWindow } from '@/lib/subsidy';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { useHasSubsidy, useSubsidyHistory, useSubsidyProgram, useSubsidyUsage } from '@/lib/use-subsidy';
import { SubsidyStatus } from '@/types/subsidy';
import { formatWalletAddress } from '@/utils/formatters';
import { CircularProgress } from '@mui/material';
import dayjs from 'dayjs';
import { ReactNode } from 'react';
import styles from './subsidy-section.module.css';

type SubsidyHeaderProps = {
  action?: ReactNode;
  chip?: ReactNode;
  subtitle?: ReactNode;
};

const SubsidyHeader = ({ action, chip, subtitle }: SubsidyHeaderProps) => (
  <div className={styles.header}>
    <div className={styles.headerText}>
      <div className={styles.titleRow}>
        <h4>OPF subsidy</h4>
        {chip}
        <SubsidyInfoButton />
      </div>
      {subtitle ? <span className={styles.muted}>{subtitle}</span> : null}
    </div>
    {action}
  </div>
);

type SpendOrderProps = {
  credit: number;
  discount: number;
};

const SpendOrder = ({ credit, discount }: SpendOrderProps) => {
  if (credit + discount <= 0) {
    return null;
  }
  return (
    <div aria-hidden className={styles.spendOrder}>
      {credit > 0 ? <div className={toneStyles.credit} style={{ flexGrow: credit }} /> : null}
      {discount > 0 ? <div className={toneStyles.discount} style={{ flexGrow: discount }} /> : null}
    </div>
  );
};

const ActiveSubsidy = () => {
  const { data: program, isError: isProgramError, isLoading: isProgramLoading } = useSubsidyProgram();
  const { data: usage, isError: isUsageError, isLoading: isUsageLoading } = useSubsidyUsage();
  const { data: history } = useSubsidyHistory();
  const opfHistory = history?.filter((entry) => entry.oneTime + entry.discount > 0) ?? [];
  const subsidizedTotal = opfHistory.reduce((sum, entry) => sum + entry.oneTime + entry.discount, 0);

  if (isProgramLoading || isUsageLoading) {
    return <CircularProgress className="alignSelfCenter" />;
  }

  const discountWindow = usage?.discount ? getBindingWindow(usage.discount.windows) : null;
  const creditLeft = (program?.oneTime && usage?.oneTime?.remaining) || 0;
  const discountRemaining = usage?.discount?.remaining ?? 0;
  const discountLeft =
    program?.discount && discountWindow && Number.isFinite(discountRemaining) ? discountRemaining : 0;
  const discountUnlimited = !!program?.discount && !!usage?.discount && !discountWindow;

  const chip = !usage ? null : usage.paused ? (
    <span className="chip chipError">Unavailable</span>
  ) : !usage.userAllowed ? (
    <span className="chip chipWarning">Not active yet</span>
  ) : (
    <span className="chip chipSuccess">Active</span>
  );

  return (
    <>
      <SubsidyHeader chip={chip} />
      {isProgramError || isUsageError ? (
        <span className={styles.small}>Couldn&apos;t load your subsidy details. Try again later.</span>
      ) : !program || !usage ? (
        <span className={styles.small}>The subsidy isn&apos;t available on this network right now.</span>
      ) : (
        <>
          {!usage.userAllowed ? (
            <span className={styles.small}>
              Your wallet isn&apos;t on the subsidy list yet. Jobs and models are charged in full until it is.
            </span>
          ) : null}
          <div className={styles.summary}>
            <div className={styles.available}>
              <span className={styles.availableAmount}>
                {discountUnlimited ? 'No limit' : formatSubsidyAmount(creditLeft + discountLeft)}
              </span>
              {discountUnlimited ? null : <span className={styles.availableLabel}>{USDC.symbol} available now</span>}
            </div>
            <SpendOrder credit={creditLeft} discount={discountLeft} />
          </div>
          <div className={styles.blocks}>
            {program.oneTime && usage.oneTime ? (
              <CreditBlock allowance={usage.oneTime} percent={program.oneTime.percent} />
            ) : null}
            {program.discount && usage.discount ? (
              <DiscountBlock percent={program.discount.percent} windows={usage.discount.windows} />
            ) : null}
          </div>
          {opfHistory.length > 0 ? (
            <span className={styles.small}>
              Subsidized so far: <strong>{formatSubsidyTokenAmount(subsidizedTotal)}</strong> across {opfHistory.length}{' '}
              {opfHistory.length === 1 ? 'job or service' : 'jobs and services'}
            </span>
          ) : null}
        </>
      )}
    </>
  );
};

const getProgressSteps = (status: SubsidyStatus | null): FlowStep[] => {
  const emailVerified = status === SubsidyStatus.EMAIL_VERIFIED;
  return [
    {
      title: 'Submit details',
      description: 'Share some info with us',
      status: status ? 'complete' : undefined,
    },
    {
      title: 'Verify email',
      description: 'Enter the code we emailed you',
      status: emailVerified ? 'complete' : status ? 'attention' : undefined,
    },
    {
      title: 'Claim',
      description: 'Add your wallet to the subsidy contract',
      status: emailVerified ? 'attention' : undefined,
    },
  ];
};

const SubsidySection = () => {
  const { account } = useOceanAccount();
  const { subsidyInfo, subsidyInfoError } = useProfileContext();
  const { data: usage, isLoading: isUsageLoading } = useSubsidyUsage();
  const hasSubsidy = useHasSubsidy();
  const isActive = !!usage?.userAllowed || subsidyInfo?.status === SubsidyStatus.CLAIMED;

  const renderContent = () => {
    if (isUsageLoading) {
      return <CircularProgress className="alignSelfCenter" />;
    }

    if (isActive) {
      return <ActiveSubsidy />;
    }

    if (!subsidyInfo) {
      return subsidyInfoError ? <SubsidyStatusError /> : <CircularProgress className="alignSelfCenter" />;
    }

    const appliedOn = subsidyInfo.applicationDate ? dayjs(subsidyInfo.applicationDate).format('MMM D, YYYY') : null;

    if (subsidyInfo.status === SubsidyStatus.PENDING) {
      return (
        <>
          <SubsidyHeader
            action={
              <Button
                color="accent1"
                href="/subsidy/verify"
                onClick={() => captureSubsidyCtaClick('account', 'verify')}
                size="md"
              >
                Verify email
              </Button>
            }
            chip={<span className="chip chipWarning">Email not verified</span>}
            subtitle={[appliedOn ? `Applied ${appliedOn}` : null, subsidyInfo.maskedEmail].filter(Boolean).join(' · ')}
          />
          <FlowSteps steps={getProgressSteps(SubsidyStatus.PENDING)} title="Subsidy progress" />
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
          <FlowSteps steps={getProgressSteps(SubsidyStatus.EMAIL_VERIFIED)} title="Subsidy progress" />
          <SubsidyTiles />
          <div className={styles.footer}>
            <span className={styles.small}>
              Claim to add your wallet to the subsidy contract and start using your subsidy.
            </span>
            <Button
              color="accent1"
              href="/subsidy/claim"
              onClick={() => captureSubsidyCtaClick('account', 'claim')}
              size="md"
            >
              Claim subsidy
            </Button>
          </div>
        </>
      );
    }

    return (
      <>
        <SubsidyHeader
          chip={<span className="chip chipGlass">Not applied</span>}
          subtitle="Apply to get discounts on compute jobs and inference services on supported nodes"
        />
        <div className={styles.offer}>
          <span className={styles.offerLabel}>What you get once you apply and claim:</span>
          <SubsidyTiles />
        </div>
        <FlowSteps steps={getProgressSteps(null)} title="How to get it" />
        <div className="actionsGroupLgCenter">
          <Button
            color="accent1"
            href="/subsidy/details"
            onClick={() => captureSubsidyCtaClick('account', 'details')}
            size="lg"
          >
            Get the subsidy
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
      <CustomSubsidies />
      {hasSubsidy ? <SubsidyHistory /> : null}
    </>
  );
};

export default SubsidySection;
