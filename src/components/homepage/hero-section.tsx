import { ButtonStyle } from '../button/butoon-style.enum';
import Button from '../button/button';
import Container from '../container/container';
import styles from './hero-section.module.css';
import LogoSlider from './logo-slider';

export default function HeroSection() {
  return (
    <div className={styles.root}>
      <div className={styles.backgroundAnimation}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt="Background animation" src={'/banner-video.jpg'} className={styles.backgorundImage} />
      </div>
      <Container className={styles.relative}>
        <div className={styles.titleWrapper}>
          <h1 className={styles.title}>
            Global <br />
            Compute <br />
            <span>Power</span>
          </h1>
          <div className={styles.subTitle}>
            Keep control of your data, jobs & infrastructure on a decentralized compute network.
          </div>
        </div>
        <div className={styles.actionsAndTextWrapper}>
          <div className={styles.actions}>
            <Button style={ButtonStyle.PRIMARY}>Run Compute Job</Button>
            <Button>Run a Node</Button>
          </div>
          <div className={styles.textBadge}>
            ONE <br />
            <span>NETWORK</span>
          </div>
        </div>
      </Container>
      <LogoSlider />
    </div>
  );
}
