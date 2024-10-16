import React from 'react'
import styles from './EmpowerSection.module.css'

const EmpowerSection: React.FC = () => {
  return (
    <div className={styles.container}>
      <h2>EMPOWER DECENTRALIZED AI</h2>
      <p>
        Set up your Ocean Node today and unlock new opportunities in data privacy and
        monetization.
      </p>
      <button className={styles.runNode}>RUN YOUR NODE TODAY</button>
    </div>
  )
}

export default EmpowerSection
