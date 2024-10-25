import React from 'react'
import Link from 'next/link'
import { getRoutes } from '../../config'
import styles from './TotalEligibleCard.module.css'

interface TotalEligibleCardProps {
  total: string
}

const TotalEligibleCard: React.FC<TotalEligibleCardProps> = ({ total }) => {
  const routes = getRoutes()

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h3>Total Eligible</h3>
        <Link href={routes.nodes.path} className={styles.viewAll}>
          VIEW ALL
        </Link>
      </div>
      <div className={styles.total}>{total}</div>
    </div>
  )
}

export default TotalEligibleCard
