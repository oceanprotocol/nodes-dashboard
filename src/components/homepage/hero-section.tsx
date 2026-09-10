import { getRoutes } from '@/config';
import { Collapse } from '@mui/material';
import { useEffect, useState } from 'react';
import { TransitionGroup } from 'react-transition-group';
import Button from '../button/button';
import Container from '../container/container';
import styles from './hero-section.module.css';
import LegacyEscrowBanner from './legacy-escrow-banner';

const videoSrc = '/hero.mp4';
// const posterSrc = '/hero.jpg';

const subtitles = [
  'Code to node in one click',
  'Run any open model by the hour',
  'Point your agent at real hardware',
  'Earn with the GPUs you already own',
];

export default function HeroSection() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prevIndex) => (prevIndex + 1) % subtitles.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={styles.root}>
      <video
        autoPlay
        className={styles.video}
        loop
        muted
        playsInline
        // poster={posterSrc}
        preload="auto"
        src={videoSrc}
      />
      <Container className={styles.relative}>
        <LegacyEscrowBanner className={styles.legacyEscrowBanner} escrowPageLink />
        <div className={styles.titleWrapper}>
          <h1 className={styles.title}>
            Global <br />
            Compute <br />
            <span>Power</span>
          </h1>
          <p className={styles.description}>
            A peer to peer GPU cloud for AI: Inference and compute jobs booked by the hour and yours alone while it
            runs.
          </p>
          <TransitionGroup>
            {subtitles.map((subtitle, index) =>
              index === activeIndex ? (
                <Collapse key={`${index}-${subtitle}`}>
                  <div className={styles.subTitle}>
                    <span>{subtitle}</span>
                  </div>
                </Collapse>
              ) : null
            )}
          </TransitionGroup>
        </div>
        <div className={styles.actionsAndTextWrapper}>
          <div className={styles.actions}>
            <Button color="accent1" href={getRoutes().inference.path} size="lg">
              Use a model
            </Button>
            <Button color="accent1" href={getRoutes().runJob.path} size="lg" variant="outlined">
              Run a job
            </Button>
          </div>
          {/* <div className={styles.textBadge}>
            ONE <br />
            <span>NETWORK</span>
          </div> */}
        </div>
      </Container>
      {/* <LogoSlider /> */}
    </div>
  );
}
