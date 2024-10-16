import React from 'react'
import styles from './SocialMediaFooter.module.css'
import Image from 'next/image'

const SocialMediaFooter: React.FC = () => {
  return (
    <footer className={styles.footer}>
      <div className={styles.content}>
        <div className={styles.text}>
          <h2>Join Us</h2>
          <p>
            Control your data with Ocean Nodes. Empower yourself with decentralized AI and
            shape the future of data privacy.
          </p>
        </div>
        <div className={styles.socialIcons}>
          <a href="#" aria-label="Medium">
            <Image src="/icons/medium.svg" alt="Medium" width={60} height={60} />
          </a>
          <a href="#" aria-label="X (Twitter)">
            <Image src="/icons/twitter.svg" alt="X (Twitter)" width={60} height={60} />
          </a>
          <a href="#" aria-label="Discord">
            <Image src="/icons/discord.svg" alt="Discord" width={60} height={60} />
          </a>
          <a href="#" aria-label="YouTube">
            <Image src="/icons/youtube.svg" alt="YouTube" width={60} height={60} />
          </a>
          <a href="#" aria-label="Telegram">
            <Image src="/icons/telegram.svg" alt="Telegram" width={60} height={60} />
          </a>
          <a href="#" aria-label="Meetup">
            <Image src="/icons/meetup.svg" alt="Meetup" width={60} height={60} />
          </a>
          <a href="#" aria-label="Instagram">
            <Image src="/icons/instagram.svg" alt="Instagram" width={60} height={60} />
          </a>
        </div>
      </div>
    </footer>
  )
}

export default SocialMediaFooter
