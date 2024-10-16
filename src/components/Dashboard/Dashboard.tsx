import React from 'react'
import Card from '../Card/Card'
import styles from './Dashboard.module.css'

const generateMockData = () => {
  const eligibleNodes = Array.from({ length: 21 }, () => ({
    value: Math.floor(Math.random() * 100) + 400
  }))
  const totalNodes = Array.from({ length: 30 }, (_, i) => ({
    value: Math.floor(Math.random() * 200) + 800 + i * 10
  }))

  return {
    eligibleNodes,
    totalNodes,
    totalCountries: 5,
    lastYearEligibleNodes: 500,
    lastYearTotalNodes: 1000,
    totalRewards: 19.0015
  }
}

const mockData = generateMockData()

const Dashboard = () => {
  return (
    <div className={styles.dashboard}>
      <Card
        title="Total Eligible Nodes"
        chartType="bar"
        chartData={mockData.eligibleNodes}
        additionalInfo={
          <div className={styles.lastYear}>
            Last year <span>{mockData.lastYearEligibleNodes}</span>
          </div>
        }
      />
      <Card title="Total Countries" bigNumber={mockData.totalCountries} />
      <Card
        title="Total Nodes"
        chartType="line"
        chartData={mockData.totalNodes}
        additionalInfo={
          <div className={styles.nodeStats}>
            <div className={styles.greenBox}>↑ 7.65%</div>
            <div className={styles.lastYear}>
              Last year <span>{mockData.lastYearTotalNodes}</span>
            </div>
          </div>
        }
      />
      <Card
        title="Total Rewards"
        additionalInfo={
          <div className={styles.rewardAmount}>
            <span className={styles.oceanText}>OCEAN</span>
            <span className={styles.rewardNumber}>{mockData.totalRewards}</span>
          </div>
        }
      />
    </div>
  )
}

export default Dashboard
