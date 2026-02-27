import BoxIcon from '@/assets/icons/box.svg';
import CreditCardIcon from '@/assets/icons/credit-card.svg';
import GlobeIcon from '@/assets/icons/globe.svg';
import LockIcon from '@/assets/icons/lock.svg';
import PlayIcon from '@/assets/icons/play.svg';
import ShieldIcon from '@/assets/icons/shield.svg';
import SliderIcon from '@/assets/icons/slider.svg';
import UsersIcon from '@/assets/icons/users.svg';
import Card from '@/components/card/card';
import cx from 'classnames';
import { CSSProperties } from 'react';
import Container from '../container/container';
import SectionTitle from '../section-title/section-title';
import styles from './features.module.css';

const features: {
  title: string;
  description: string;
  icon: JSX.Element;
  isBlue?: boolean;
}[] = [
  {
    title: 'Pay-per-use',
    description:
      'Only pay for the compute you use. You are not billed while idle and you are not locked into a fixed instance.',
    icon: <CreditCardIcon />,
  },
  {
    title: 'Ease of use',
    description: 'Launch from VS Code. Clear logs and status in one place.',
    icon: <PlayIcon />,
    isBlue: true,
  },
  {
    title: 'Container-Based',
    description: 'Bring your own container or use templates. Reproducible runs and consistent results.',
    icon: <BoxIcon />,
    isBlue: true,
  },
  {
    title: 'Maximum flexibility',
    description: 'You are not constrained to preset CPU/GPU/RAM bundles. Choose the resources you need.',
    icon: <SliderIcon />,
  },
  {
    title: 'Security',
    description: 'Isolated execution, signed attestations, on-chain provenance for jobs when applicable.',
    icon: <ShieldIcon />,
  },
  {
    title: 'Inclusive by design',
    description: 'We support both high-end rigs and smaller operators. Everyone can participate.',
    icon: <UsersIcon />,
    isBlue: true,
  },
  {
    title: 'Privacy-first jobs',
    description: 'Run algorithms where data lives. Raw data stays private and never leaves its source.',
    icon: <LockIcon />,
    isBlue: true,
  },
  {
    title: 'Global GPU/CPU pool',
    description: 'Access diverse hardware across the network to match your budget and performance needs.',
    icon: <GlobeIcon />,
  },
];

export default function FeaturesSection() {
  return (
    <div className={styles.root}>
      <Container className={styles.relative}>
        <SectionTitle
          title="Key Features"
          subTitle="Built for performance, scalability, and ease of use"
          subTitleClassName="textPrimaryInverse"
          titleClassName="textAccent2"
        />
        <div className={styles.featuresWrapper}>
          {features.map((item, index) => {
            const pulseDelay = 30 * Math.random();
            return (
              <Card
                className={cx(styles.featureItem, item.isBlue && styles.featureItemBlue)}
                key={item.title}
                padding="sm"
                radius="lg"
                shadow="black"
                variant={item.isBlue ? 'accent2' : 'accent1-outline'}
                style={
                  {
                    '--pulse-delay': `${pulseDelay}s`,
                  } as CSSProperties
                }
              >
                <div className={styles.iconWrapper}>{item.icon}</div>
                <div className={styles.featureTextWrapper}>
                  <h4 className={styles.featureTitle}>{item.title}</h4>
                  <p className={styles.featureDescription}>{item.description}</p>
                </div>
              </Card>
            );
          })}
        </div>
      </Container>
    </div>
  );
}
