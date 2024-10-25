import dynamic from 'next/dynamic'

import TotalEligibleCard from '../../TotalEligibleCard/TotalEligibleCard'
import styles from './style.module.css'

import PieChartCard from '../../PieChart/PieChart'
import TopCountriesChart from '../../TopCountriesChart/TopCountriesChart '
import HeroSection from '../../HeroSection/HeroSection'

const Map = dynamic(() => import('../../Map'), { ssr: false })

const generatePieChartData = () => {
  return [
    { name: 'Group A', value: 400, color: '#CF1FB1' },
    { name: 'Group B', value: 300, color: '#7960EC' },
    { name: 'Group C', value: 1600, color: '#fff' }
  ]
}

const generatePieChartData2 = () => {
  return [
    { name: 'Group A', value: 400, color: '#45B738' },
    { name: 'Group B', value: 300, color: '#3838F6' },
    { name: 'Group C', value: 1600, color: '#fff' }
  ]
}

const generateTopCountriesData = () => {
  return [
    { country: 'Romania', nodes: 1200 },
    { country: 'Finland', nodes: 3900 },
    { country: 'Germany', nodes: 5200 },
    { country: 'Japan', nodes: 6800 },
    { country: 'U.S.', nodes: 8500 }
  ]
}

export default function HomePage() {
  const pieChartData1 = generatePieChartData()
  const pieChartData2 = generatePieChartData2()
  const topCountriesData = generateTopCountriesData()

  return (
    <div className={styles.root}>
      <HeroSection
        title="Ocean Nodes at a Glance"
        description="Lorem ipsum dolor sit amet, consectetur adipiscing elit."
      />
      <Map />
      <div className={styles.pieCharts}>
        <PieChartCard data={pieChartData1} title="Pie Chart 1" />
        <PieChartCard data={pieChartData2} title="Pie Chart 2" />
        <TotalEligibleCard total="9.3k" />
      </div>
      <TopCountriesChart data={topCountriesData} />
    </div>
  )
}
