import { getRoutes } from '@/config';
import { Collapse } from '@mui/material';
import { useEffect, useState } from 'react';
import { TransitionGroup } from 'react-transition-group';
import Button from '../button/button';
import Container from '../container/container';
import styles from './hero-section.module.css';

const videoSrc = '/hero.mp4';
// const posterSrc = '/hero.jpg';

const subtitles = ['ON: Code-to-Node in just one click', 'ON: Run pay-per-use compute jobs', 'ON: Earn with your GPUs'];

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
        <div className={styles.titleWrapper}>
          <h1 className={styles.title}>
            Global <br />
            Compute <br />
            <span>Power</span>
          </h1>
          <TransitionGroup>
            {subtitles.map((subtitle, index) =>
              index === activeIndex ? (
                <Collapse key={`${index}-${subtitle}`}>
                  <div className={styles.subTitle}>{subtitle}</div>
                </Collapse>
              ) : null
            )}
          </TransitionGroup>
        </div>
        <div className={styles.actionsAndTextWrapper}>
          <div className={styles.actions}>
            <Button color="accent1" href={getRoutes().runJob.path} size="lg">
              Run a job
            </Button>
            <Button color="accent1" href={getRoutes().runNode.path} size="lg" variant="outlined">
              Run a node
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
