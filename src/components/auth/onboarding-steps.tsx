import Button from '@/components/button/button';
import Input from '@/components/input/input';
import {
  findGoal,
  findProfile,
  findSource,
  Lane,
  ONBOARDING_QUESTIONS,
  SOURCE_DETAIL_MAX_LENGTH,
  submitOnboardingAnswers,
} from '@/lib/onboarding';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import classNames from 'classnames';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import styles from './onboarding-steps.module.css';

type Step = 'profile' | 'goals' | 'source' | 'done';

const PROGRESS_STEPS = ['profile', 'goals', 'source'] as const;
const DONE_REDIRECT_MS = 2500;

const { done: DONE, goals: GOALS, profile: PROFILE, source: SOURCE } = ONBOARDING_QUESTIONS;

const Heading = ({ emphasis, title }: { emphasis: string; title: string }) => (
  <h1>
    {title} <em>{emphasis}</em>
  </h1>
);

const Tick = () => (
  <span aria-hidden className={styles.tick}>
    <CheckIcon />
  </span>
);

type OnboardingStepsProps = {
  address: string;
  nextPath: string;
  onFocusSlide: (slide: string) => void;
  onLeadSlide: (slide: string | null) => void;
};

const OnboardingSteps = ({ address, nextPath, onFocusSlide, onLeadSlide }: OnboardingStepsProps) => {
  const router = useRouter();

  const [goals, setGoals] = useState<string[]>([]);
  const [profile, setProfile] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [sourceDetail, setSourceDetail] = useState('');
  const [step, setStep] = useState<Step>('profile');
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState<Lane>('maker');

  useEffect(() => {
    if (step !== 'done') {
      return;
    }
    const timer = setTimeout(() => router.replace(nextPath), DONE_REDIRECT_MS);
    return () => clearTimeout(timer);
  }, [nextPath, router, step]);

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
      await submitOnboardingAnswers(address, {
        goals,
        profile,
        source: skip ? null : source,
        sourceDetail: skip ? null : sourceDetail,
      });
      setStep('done');
    } catch (cause) {
      console.error('Saving onboarding answers failed:', cause);
      toast.error('Could not save your answers. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderProfile = () => (
    <div className={styles.step} key="profile">
      <Heading emphasis={PROFILE.titleEmphasis} title={PROFILE.title} />
      <p className={styles.lead}>{PROFILE.lead}</p>
      <div aria-label={`${PROFILE.title} ${PROFILE.titleEmphasis}`} className={styles.grid} role="radiogroup">
        {PROFILE.options.map((option) => {
          const selected = profile === option.id;
          return (
            <button
              aria-checked={selected}
              className={classNames(styles.option, { [styles.selected]: selected })}
              key={option.id}
              onClick={() => selectProfile(option.id)}
              role="radio"
              type="button"
            >
              <span className={styles.optionTitle}>{option.title}</span>
              <span className={styles.optionSubtitle}>{option.subtitle}</span>
              <Tick />
            </button>
          );
        })}
      </div>
      <div className={styles.actions}>
        <span />
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
        <Heading emphasis={GOALS.titleEmphasis} title={GOALS.title} />
        <p className={styles.lead}>
          {GOALS.lead.replace('{min}', String(GOALS.min)).replace('{max}', String(GOALS.max))}
        </p>
        <div aria-label="Browse by" className={styles.tabs} role="tablist">
          {GOALS.tabs.map((goalTab) => {
            const active = goalTab.id === tab;
            return (
              <button
                aria-selected={active}
                className={classNames(styles.tab, { [styles.tabActive]: active })}
                key={goalTab.id}
                onClick={() => setTab(goalTab.id)}
                role="tab"
                type="button"
              >
                {goalTab.label}
              </button>
            );
          })}
        </div>
        <div className={styles.grid}>
          {options.map((option) => {
            const selected = goals.includes(option.id);
            return (
              <button
                aria-pressed={selected}
                className={classNames(styles.option, { [styles.selected]: selected })}
                disabled={full && !selected}
                key={option.id}
                onClick={() => toggleGoal(option.id)}
                type="button"
              >
                {option.isNew && <span className={classNames(styles.chip, styles.chipNew)}>NEW</span>}
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
                      <span
                        className={classNames(styles.chip, selected ? styles.chipNew : styles.chipGlass)}
                        key={item}
                      >
                        {item}
                      </span>
                    ))}
                  </span>
                )}
                <Tick />
              </button>
            );
          })}
        </div>
        <div aria-live="polite" className={styles.picks}>
          <span className={styles.count}>
            {goals.length} of {GOALS.max} selected{ready ? '' : ` · pick at least ${GOALS.min}`}
          </span>
          {goals.map((id) => {
            const goal = findGoal(id);
            return (
              <button
                aria-label={`Remove ${goal?.title}`}
                className={classNames(styles.chip, styles.chipRemove)}
                key={id}
                onClick={() => toggleGoal(id)}
                type="button"
              >
                {goal?.title}
                <CloseIcon />
              </button>
            );
          })}
        </div>
        <div className={styles.actions}>
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
        <Heading emphasis={SOURCE.titleEmphasis} title={SOURCE.title} />
        <p className={styles.lead}>{SOURCE.lead}</p>
        <div aria-label={`${SOURCE.title} ${SOURCE.titleEmphasis}`} className={styles.pills} role="radiogroup">
          {SOURCE.options.map((option) => {
            const selected = source === option.id;
            return (
              <button
                aria-checked={selected}
                className={classNames(styles.pill, { [styles.selected]: selected })}
                key={option.id}
                onClick={() => toggleSource(option.id)}
                role="radio"
                type="button"
              >
                {option.label}
              </button>
            );
          })}
        </div>
        {detailLabel && (
          <Input
            className={styles.reveal}
            label={detailLabel}
            maxLength={SOURCE_DETAIL_MAX_LENGTH}
            name="sourceDetail"
            onChange={(event) => setSourceDetail(event.target.value)}
            placeholder={SOURCE.detailPlaceholder}
            type="text"
            value={sourceDetail}
          />
        )}
        <div className={styles.actions}>
          <Button className={styles.back} onClick={() => setStep('goals')} size="md" variant="transparent">
            Back
          </Button>
          <div className={styles.actionsRight}>
            <Button disabled={submitting} onClick={() => finish(true)} size="md" variant="transparent">
              Skip
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
        <Heading emphasis={DONE.titleEmphasis} title={DONE.title} />
        <p className={styles.lead}>{DONE.lead}</p>
        <div className={styles.offer}>{DONE.offer}</div>
        <div className={styles.actions}>
          <span />
          <Button color="accent1" href={nextPath} size="lg">
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
        <div className={styles.foot}>
          <div aria-hidden className={styles.progress}>
            {PROGRESS_STEPS.map((item, index) => (
              <i
                className={classNames({
                  [styles.progressDone]: index < progressIndex,
                  [styles.progressCurrent]: index === progressIndex,
                })}
                key={item}
              />
            ))}
          </div>
          <span className={styles.footLabel}>
            Step {progressIndex + 1} of {PROGRESS_STEPS.length} · {progressLabel}
          </span>
        </div>
      )}
    </div>
  );
};

export default OnboardingSteps;
