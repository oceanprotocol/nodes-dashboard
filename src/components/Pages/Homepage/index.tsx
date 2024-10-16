import dynamic from 'next/dynamic'
import { Alert, Link } from '@mui/material'

import Table from '../../Table'
import TotalEligibleCard from '../../TotalEligibleCard/TotalEligibleCard'
import styles from './style.module.css'

import EmpowerSection from '../../EmpowerSection/EmpowerSection'
import PieChartCard from '../../PieChart/PieChart'
import TopCountriesChart from '../../TopCountriesChart/TopCountriesChart '

const Map = dynamic(() => import('../../Map'), { ssr: false })

const generatePieChartData = () => {
  return [
    { name: 'Group A', value: 400, color: '#CF1FB1' },
    { name: 'Group B', value: 300, color: '#7960EC' },
    { name: 'Group C', value: 1600, color: '#fff' }
  ]
}

const generateTopCountriesData = () => {
  return [
    { country: 'U.S.', nodes: 8500 },
    { country: 'Japan', nodes: 6800 },
    { country: 'Germany', nodes: 5200 },
    { country: 'Finland', nodes: 3900 },
    { country: 'Romania', nodes: 1200 }
  ]
}

export default function HomePage() {
  const pieChartData1 = generatePieChartData()
  const pieChartData2 = generatePieChartData()
  const topCountriesData = generateTopCountriesData()

  return (
    <div className={styles.root}>
      <Map />
      {/* <Alert severity="warning">
        Please note the dashboard is currently under review and the eligibility indicator
        might change. For more details, please check out the following blog post:
        <Link
          href="https://blog.oceanprotocol.com/ocean-nodes-incentives-a-detailed-breakdown-0baf8fc98001"
          target="_blank"
          rel="noopener"
        >
          Ocean Nodes Incentives: A Detailed Breakdown
        </Link>
        .
      </Alert>
      <Table /> */}
      <div className={styles.pieCharts}>
        <PieChartCard data={pieChartData1} title="Pie Chart 1" />
        <PieChartCard data={pieChartData2} title="Pie Chart 2" />
        <TotalEligibleCard total="9.3k" />
      </div>
      <TopCountriesChart data={topCountriesData} />
      <EmpowerSection />
    </div>
  )
}
