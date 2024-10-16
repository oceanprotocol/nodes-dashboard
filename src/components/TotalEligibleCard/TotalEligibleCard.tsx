import React from 'react'
import styles from './TotalEligibleCard.module.css'

interface TotalEligibleCardProps {
  total: string
}

const TotalEligibleCard: React.FC<TotalEligibleCardProps> = ({ total }) => {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h3>Total Eligible</h3>
        <button className={styles.viewAll}>VIEW ALL</button>
      </div>
      <div className={styles.total}>{total}</div>
    </div>
  )
}

export default TotalEligibleCard
