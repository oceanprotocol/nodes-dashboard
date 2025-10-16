import Image from 'next/image';
import styles from './logo-slider.module.css';

const sliderItems = [
  { src: '/banner-video.jpg', name: 'Collaborator 1' },
  { src: '/banner-video.jpg', name: 'Collaborator 2' },
  { src: '/banner-video.jpg', name: 'Collaborator 3' },
  { src: '/banner-video.jpg', name: 'Collaborator 4' },
  { src: '/banner-video.jpg', name: 'Collaborator 5' },
  { src: '/banner-video.jpg', name: 'Collaborator 6' },
  { src: '/banner-video.jpg', name: 'Collaborator 7' },
  { src: '/banner-video.jpg', name: 'Collaborator 8' },
  { src: '/banner-video.jpg', name: 'Collaborator 9' },
  { src: '/banner-video.jpg', name: 'Collaborator 10' },
];

export default function LogoSlider() {
  const items = [...sliderItems, ...sliderItems];

  const durationSec = Math.max(12, sliderItems.length * 6);

  return (
    <div className={styles.root}>
      <div className={styles.marquee} style={{ ['--duration' as any]: `${durationSec}s` }} aria-label="logo-slider">
        <div className={styles.track}>
          {items.map((item, idx) => (
            <div key={`${item.name}-${idx}`} className={styles.sliderItem}>
              <div className={styles.logoWrapper}>
                <Image alt={item.name} src={item.src} width={80} height={80} className={styles.logoImage} />
              </div>
              <div className={styles.name}>{item.name}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
