import Button from '@/components/button/button';
import Card from '@/components/card/card';
import Input from '@/components/input/input';
import ProgressBar from '@/components/progress-bar/progress-bar';
import TabBar from '@/components/tab-bar/tab-bar';
import {
  findGoal,
  findProfile,
  findSource,
  getOnboardingDestination,
  Lane,
  ONBOARDING_QUESTIONS,
  SOURCE_DETAIL_MAX_LENGTH,
} from '@/lib/onboarding';
import { useOnboardingSubmit } from '@/lib/use-onboarding-submit';
import { WalletAuthError } from '@/lib/wallet-auth';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import classNames from 'classnames';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import AuthHeading from './auth-heading';
import styles from './onboarding-steps.module.css';

type Step = 'profile' | 'goals' | 'source' | 'done';

const PROGRESS_STEPS = ['profile', 'goals', 'source'] as const;
const DONE_REDIRECT_MS = 2500;

const { done: DONE, goals: GOALS, profile: PROFILE, source: SOURCE } = ONBOARDING_QUESTIONS;

const Tick = () => (
  <span aria-hidden className={styles.tick}>
    <CheckIcon />
  </span>
);

type OnboardingStepsProps = {
  address: string;
  nextPath: string | null;
  onFocusSlide: (slide: string) => void;
  onLeadSlide: (slide: string | null) => void;
};

const OnboardingSteps = ({ address, nextPath, onFocusSlide, onLeadSlide }: OnboardingStepsProps) => {
  const router = useRouter();
  const submitAnswers = useOnboardingSubmit(address);

  const [goals, setGoals] = useState<string[]>([]);
  const [profile, setProfile] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [source, setSource] = useState<string | null>(null);
  const [sourceDetail, setSourceDetail] = useState('');
  const [step, setStep] = useState<Step>('profile');
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState<Lane>('maker');

  const [submittedDestination, setSubmittedDestination] = useState<string | null>(null);

  const destination = nextPath ?? submittedDestination ?? '/';

  useEffect(() => {
    if (step !== 'done') {
      return;
    }
    const timer = setTimeout(() => router.replace(destination), DONE_REDIRECT_MS);
    return () => clearTimeout(timer);
  }, [destination, router, step]);

  const selectProfile = (id: string) => {
    const option = findProfile(id);
    if (!option) {
      return;
    }
    if (id !== profile) {
      setGoals([]);
      setTab(option.lane ?? 'maker');
    }
    setProfile(id);
    onLeadSlide(option.slide);
  };

  const toggleGoal = (id: string) => {
    if (goals.includes(id)) {
      setGoals(goals.filter((goal) => goal !== id));
      return;
    }
    if (goals.length >= GOALS.max) {
      return;
    }
    setGoals([...goals, id]);
    const slide = findGoal(id)?.slide;
    if (slide) {
      onFocusSlide(slide);
    }
  };

  const toggleSource = (id: string) => {
    setSource(source === id ? null : id);
    setSourceDetail('');
  };

  const finish = async (skip: boolean) => {
    if (!profile) {
      return;
    }
    setSubmitting(true);
    try {
      const status = await submitAnswers({
        goals,
        profile,
        source: skip ? null : source,
        sourceDetail: skip ? null : sourceDetail,
      });
      setSubmittedDestination(status.destination);
      setStep('done');
    } catch (cause) {
      console.error('Saving onboarding answers failed:', cause);
      toast.error(
        cause instanceof WalletAuthError
          ? 'Sign the message in your wallet to save your answers, or continue without saving.'
          : 'Could not save your answers. Try again, or continue without saving.'
      );
      setSaveFailed(true);
    } finally {
      setSubmitting(false);
    }
  };

  const skip = () => {
    if (saveFailed) {
      router.replace(nextPath ?? getOnboardingDestination(goals));
      return;
    }
    finish(true);
  };

  const renderProfile = () => (
    <div className={styles.step} key="profile">
      <AuthHeading emphasis={PROFILE.titleEmphasis} title={PROFILE.title} />
      <p className={classNames('textSecondary text16', styles.lead)}>{PROFILE.lead}</p>
      <div className={styles.grid}>
        {PROFILE.options.map((option) => {
          const selected = profile === option.id;
          return (
            <Button
              aria-pressed={selected}
              className={classNames(styles.option, { [styles.selected]: selected })}
              color={selected ? 'accent2' : 'primary-inverse'}
              key={option.id}
              onClick={() => selectProfile(option.id)}
              variant={selected ? 'filled' : 'glass'}
            >
              <span className={styles.optionTitle}>{option.title}</span>
              <span className={styles.optionSubtitle}>{option.subtitle}</span>
              <Tick />
            </Button>
          );
        })}
      </div>
      <div className={classNames('actionsGroupMdEnd', styles.actions)}>
        <Button color="accent1" disabled={!profile} onClick={() => setStep('goals')} size="lg">
          Continue
        </Button>
      </div>
    </div>
  );

  const renderGoals = () => {
    const full = goals.length >= GOALS.max;
    const ready = goals.length >= GOALS.min;
    const options = GOALS.tabs.find((goalTab) => goalTab.id === tab)?.options ?? [];
    return (
      <div className={styles.step} key="goals">
        <AuthHeading emphasis={GOALS.titleEmphasis} title={GOALS.title} />
        <p className={classNames('textSecondary text16', styles.lead)}>
          {GOALS.lead.replace('{min}', String(GOALS.min)).replace('{max}', String(GOALS.max))}
        </p>
        <TabBar
          activeKey={tab}
          ariaLabel="Browse by"
          className={styles.tabs}
          size="sm"
          tabs={GOALS.tabs.map((goalTab) => ({
            key: goalTab.id,
            label: goalTab.label,
            onClick: () => setTab(goalTab.id),
          }))}
        />
        <div className={styles.grid}>
          {options.map((option) => {
            const selected = goals.includes(option.id);
            return (
              <Button
                aria-pressed={selected}
                className={classNames(styles.option, { [styles.selected]: selected })}
                color={selected ? 'accent2' : 'primary-inverse'}
                disabled={full && !selected}
                key={option.id}
                onClick={() => toggleGoal(option.id)}
                variant={selected ? 'filled' : 'glass'}
              >
                {option.isNew && <span className={classNames('chip chipAccent1', styles.chip)}>NEW</span>}
                <span className={styles.optionTitle}>{option.title}</span>
                <span className={styles.optionSubtitle}>{option.subtitle}</span>
                {option.logos && (
                  <span className={styles.logos}>
                    {option.logos.map((logo) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img alt="" key={logo} src={`/logos/templates/${logo}.svg`} />
                    ))}
                  </span>
                )}
                {option.meta && (
                  <span className={styles.meta}>
                    {option.meta.map((item) => (
                      <span className={classNames('chip chipGlass', styles.chip)} key={item}>
                        {item}
                      </span>
                    ))}
                  </span>
                )}
                <Tick />
              </Button>
            );
          })}
        </div>
        <div aria-live="polite" className={classNames('flexRow alignItemsCenter gapSm', styles.picks)}>
          <span className={classNames('textSecondary', styles.count)}>
            {goals.length} of {GOALS.max} selected{ready ? '' : ` · pick at least ${GOALS.min}`}
          </span>
          {goals.map((id) => {
            const goal = findGoal(id);
            return (
              <Button
                aria-label={`Remove ${goal?.title}`}
                color="accent2"
                contentAfter={<CloseIcon fontSize="inherit" />}
                key={id}
                onClick={() => toggleGoal(id)}
                size="sm"
              >
                {goal?.title}
              </Button>
            );
          })}
        </div>
        <div className={classNames('actionsGroupMdBetween', styles.actions)}>
          <Button className={styles.back} onClick={() => setStep('profile')} size="md" variant="transparent">
            Back
          </Button>
          <Button color="accent1" disabled={!ready} onClick={() => setStep('source')} size="lg">
            Continue
          </Button>
        </div>
      </div>
    );
  };

  const renderSource = () => {
    const detailLabel = findSource(source)?.detail;
    return (
      <div className={styles.step} key="source">
        <AuthHeading emphasis={SOURCE.titleEmphasis} title={SOURCE.title} />
        <p className={classNames('textSecondary text16', styles.lead)}>{SOURCE.lead}</p>
        <div className={classNames('flexRow gapSm', styles.pills)}>
          {SOURCE.options.map((option) => {
            const selected = source === option.id;
            return (
              <Button
                aria-pressed={selected}
                color={selected ? 'accent2' : 'primary-inverse'}
                disabled={submitting}
                key={option.id}
                onClick={() => toggleSource(option.id)}
                variant={selected ? 'filled' : 'glass'}
              >
                {option.label}
              </Button>
            );
          })}
        </div>
        {detailLabel && (
          <Input
            className={styles.reveal}
            disabled={submitting}
            label={detailLabel}
            maxLength={SOURCE_DETAIL_MAX_LENGTH}
            name="sourceDetail"
            onChange={(event) => setSourceDetail(event.target.value)}
            placeholder={SOURCE.detailPlaceholder}
            type="text"
            value={sourceDetail}
          />
        )}
        <div className={classNames('actionsGroupMdBetween', styles.actions)}>
          <Button
            className={styles.back}
            disabled={submitting}
            onClick={() => setStep('goals')}
            size="md"
            variant="transparent"
          >
            Back
          </Button>
          <div className="actionsGroupMdEnd">
            <Button disabled={submitting} onClick={skip} size="md" variant="transparent">
              {saveFailed ? 'Continue without saving' : 'Skip'}
            </Button>
            <Button color="accent1" loading={submitting} onClick={() => finish(false)} size="lg">
              Finish
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const renderDone = () => {
    const lane = findProfile(profile)?.lane;
    return (
      <div className={styles.step} key="done">
        <div className={styles.doneBadge}>
          <CheckIcon />
        </div>
        <AuthHeading emphasis={DONE.titleEmphasis} title={DONE.title} />
        <p className={classNames('textSecondary text16', styles.lead)}>{DONE.lead}</p>
        <Card className={styles.offer} paddingX="sm" paddingY="xs" radius="md" variant="accent2">
          {DONE.offer}
        </Card>
        <div className={classNames('actionsGroupMdEnd', styles.actions)}>
          <Button color="accent1" href={destination} size="lg">
            {DONE.cta[lane ?? 'default']}
          </Button>
        </div>
      </div>
    );
  };

  const progressIndex = PROGRESS_STEPS.indexOf(step as (typeof PROGRESS_STEPS)[number]);
  const progressLabel = [PROFILE.label, GOALS.label, SOURCE.label][progressIndex];

  return (
    <div className={styles.flow}>
      <div className={styles.body}>
        {step === 'profile' && renderProfile()}
        {step === 'goals' && renderGoals()}
        {step === 'source' && renderSource()}
        {step === 'done' && renderDone()}
      </div>
      {progressIndex >= 0 && (
        <ProgressBar
          bottomLeftContent={
            <span className="textSecondary">
              Step {progressIndex + 1} of {PROGRESS_STEPS.length} · {progressLabel}
            </span>
          }
          className={styles.foot}
          value={((progressIndex + 1) / PROGRESS_STEPS.length) * 100}
        />
      )}
    </div>
  );
};

export default OnboardingSteps;
