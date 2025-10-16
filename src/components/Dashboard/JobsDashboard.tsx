import React, { useEffect } from 'react'
import Card from '../Card/Card'
import styles from './Dashboard.module.css'
import { useNodesContext } from '../../context/NodesContext'
import DashboardErrorDisplay from './DashboardErrorDisplay'
import { formatNumber } from '../../utils/formatters'
import { useJobsDashboardData } from './useJobsDashboardData'

const JobsDashboard = () => {
  const { error, rewardsHistory, fetchRewardsHistory, overallDashboardLoading } =
    useNodesContext()

  const { eligibleNodesChartData, totalRewardsSumFromEligibleNodesChart } =
    useJobsDashboardData({
      rewardsHistory
    })

  useEffect(() => {
    fetchRewardsHistory()
  }, [fetchRewardsHistory])

  if (error) {
    return <DashboardErrorDisplay error={error} />
  }

  // TODO style
  return (
    <div className={styles.dashboard}>
      <div>
        <div>Total revenue</div>
        <div>
          <span>ROSE</span>
          <span>13.05M</span>
        </div>
      </div>

      <Card
        title="Total revenue"
        chartType="line"
        chartData={rewardsHistory}
        isLoading={overallDashboardLoading}
        additionalInfo={
          <div className={styles.chartBottomInfo}>
            <div className={styles.totalRewardsContainer}>
              <div className={styles.lastYearText}>Total Rewards</div>
              <div className={styles.periodAverage}>
                <span className={styles.totalRewards}>
                  {formatNumber(totalRewardsSumFromEligibleNodesChart)}
                </span>
                <span className={styles.rose}>ROSE</span>
              </div>
            </div>
          </div>
        }
      />

      <Card
        title="Nodes per epoch"
        chartType="bar"
        chartData={eligibleNodesChartData}
        isLoading={overallDashboardLoading}
      />
    </div>
  )
}

export default JobsDashboard
