import { useVideoScroll } from '../../hooks/useVideoScroll';
import Container from '../container/container';
import SectionTitle from '../section-title/section-title';
import styles from './how-it-works.module.css';

const itemsList: {
  title: string;
  description: string;
}[] = [
  {
    title: 'Select Environment',
    description: 'Use the Smart Compute Wizard to filter by GPU/CPU, RAM, storage, location, and price.',
  },
  {
    title: 'Define Resources',
    description: 'Pick container or template, set params and limits.',
  },
  {
    title: 'Fund the Job',
    description: 'Allocate funds in escrow. See a clear cost estimate before launch.',
  },
  {
    title: 'Maximum flexibility',
    description: 'You are not constrained to preset CPU/GPU/RAM bundles. Choose the resources you need.',
  },
  {
    title: 'Run Job',
    description: 'Execution on Ocean Nodes with live status and logs.',
  },
  {
    title: 'Get Results',
    description: 'Outputs are returned. Raw data remains private.',
  },
];

const videoSrc = '/globe_how-it-works.mp4';
const posterSrc = '/banner-how-it-works.png';

export default function HowItWorksSection() {
  const { sectionRef, videoRef, activeIndex } = useVideoScroll({
    numSteps: itemsList.length,
  });

  return (
    <div className={styles.root} ref={sectionRef} tabIndex={0} aria-label="How it works, step-by-step">
      <Container className={styles.relative}>
        <SectionTitle title="How It works" subTitle="Run compute jobs and train AI models in a few simple steps" />
        <div className={styles.twoSections}>
          <div className={styles.featuresWrapper}>
            {itemsList.map((item, index) => (
              <div
                key={item.title}
                className={`${styles.featureItem} ${index === activeIndex ? styles.featureItemActive : ''}`}
              >
                <div className={styles.indexNumber}>0{index + 1}</div>
                <div className={styles.featureTextWrapper}>
                  <h4 className={styles.featureTitle}>{item.title}</h4>
                  <p className={styles.featureDescription}>{item.description}</p>
                </div>
              </div>
            ))}
          </div>
          <div className={styles.animation}>
            <video ref={videoRef} src={videoSrc} muted playsInline preload="auto" poster={posterSrc} />
          </div>
        </div>
      </Container>
    </div>
  );
}
