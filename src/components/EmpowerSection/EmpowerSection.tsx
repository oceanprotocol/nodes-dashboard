import React from 'react'
import styles from './EmpowerSection.module.css'
import { getLinks } from '@/config'

const EmpowerSection: React.FC = () => {
  const links = getLinks()

  return (
    <div className={styles.container}>
      <h2>EMPOWER DECENTRALIZED AI</h2>
      <p>
        Set up your Ocean Node today and unlock new opportunities in data privacy and
        monetization.
      </p>
      <a href={links.github} target="_blank" rel="noopener noreferrer">
        <button className={styles.runNode}>RUN YOUR NODE TODAY</button>
      </a>
    </div>
  )
}

export default EmpowerSection
