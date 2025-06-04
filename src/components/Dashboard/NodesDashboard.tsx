import React, { useEffect } from 'react'
import Card from '../Card/Card'
import styles from './Dashboard.module.css'
import { useNodesContext } from '../../context/NodesContext'
import DashboardErrorDisplay from './DashboardErrorDisplay'
import { useNodesDashboardData } from './useNodesDashboardData'
import { formatNumber } from '../../utils/formatters'

const NodesDashboard = () => {
  const {
    error,
    totalNodes,
    rewardsHistory,
    averageIncentiveData,
    fetchRewardsHistory,
    overallDashboardLoading
  } = useNodesContext()

  const {
    averageTrendInfo,
    periodAverage,
    eligibleNodesChartData,
    totalRewardsSumFromEligibleNodesChart
  } = useNodesDashboardData({
    averageIncentiveData,
    rewardsHistory
  })

  useEffect(() => {
    fetchRewardsHistory()
  }, [fetchRewardsHistory])

  if (error) {
    return <DashboardErrorDisplay error={error} />
  }

  return (
    <div className={styles.dashboard}>
      <Card
        title="Total Nodes"
        bigNumber={totalNodes ?? 0}
        isLoading={overallDashboardLoading}
      />
      <Card
        title="Average Incentive"
        chartType="line"
        chartData={averageIncentiveData}
        isLoading={overallDashboardLoading}
        additionalInfo={
          <div className={styles.chartBottomInfo}>
            <div className={styles.percentChangeContainer}>
              <div
                className={styles.percentChange}
                style={{
                  backgroundColor:
                    averageTrendInfo.trend === 'up'
                      ? 'rgba(100, 255, 100, 0.2)'
                      : 'rgba(255, 100, 100, 0.2)',
                  color:
                    averageTrendInfo.trend === 'up'
                      ? 'rgb(100, 210, 100)'
                      : 'rgb(210, 100, 100)'
                }}
              >
                {averageTrendInfo.trend === 'up' ? '+' : '-'}
                {averageTrendInfo.percentage}%
              </div>
            </div>
            <div className={styles.lastYear}>
              <div className={styles.lastYearText}>Per Period</div>
              <div className={styles.periodAverage}>
                <span>{periodAverage.toFixed(3)} </span>
                <span className={styles.rose}>Rose</span>
              </div>
            </div>
          </div>
        }
      />
      <Card
        title="Eligible Nodes per Epoch"
        chartType="bar"
        chartData={eligibleNodesChartData}
        isLoading={overallDashboardLoading}
      />
      <Card
        title="Rewards History"
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
    </div>
  )
}

export default NodesDashboard
