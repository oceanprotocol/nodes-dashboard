import { getLinks } from '@/config';
import styles from './style.module.css';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const links = getLinks();

  return (
    <div className={styles.footer}>
      <div className={styles.footerContainer}>
        <p>@ {currentYear}, Ocean Nodes</p>
        <div className={styles.footerLinks}>
          <a href={links.website} target="_blank" rel="noopener noreferrer">
            Website
          </a>
          <a href={links.github} target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
        </div>
      </div>
    </div>
  );
};

export default Footer;
