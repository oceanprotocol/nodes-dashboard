import dynamic from 'next/dynamic'
import { useEffect } from 'react'

import styles from './style.module.css'

import PieChartCard from '../../PieChart/PieChart'
import HeroSection from '../../HeroSection/HeroSection'
import { useDataContext } from '../../../context/DataContext'
import TopCountriesChart from '../../TopCountriesChart/TopCountriesChart '

const Map = dynamic(() => import('../../Map'), { ssr: false })

interface SystemStats {
  cpuCounts: { [key: string]: number }
  operatingSystems: { [key: string]: number }
  cpuArchitectures: { [key: string]: number }
}

const brandColors = {
  primary: ['#7b1173', '#bd2881', '#d53288', '#e000cf', '#fe4796', '#ff4092'],
  other: '#f7f7f7'
}

interface ChartDataItem {
  name: string
  value: number
  color: string
  details?: string[]
}

const processChartData = (
  data: Record<string, number>,
  maxSlices: number
): ChartDataItem[] => {
  if (!data) return []

  const sortedEntries = Object.entries(data).sort(([, a], [, b]) => b - a)

  const mainEntries = sortedEntries.slice(0, maxSlices)
  const otherEntries = sortedEntries.slice(maxSlices)
  const otherCount = otherEntries.reduce((sum, [, count]) => sum + count, 0)

  const result = mainEntries.map(
    ([key, count], index): ChartDataItem => ({
      name: key,
      value: count,
      color: brandColors.primary[index]
    })
  )

  if (otherCount > 0) {
    result.push({
      name: 'Other',
      value: otherCount,
      color: brandColors.other,
      details: otherEntries.map(([key, count]) => `${key}: ${count} nodes`)
    })
  }

  return result
}

const processCpuData = (stats: SystemStats): ChartDataItem[] => {
  if (!stats?.cpuCounts) return []
  const data = processChartData(stats.cpuCounts, 5)
  return data.map((item) => ({
    ...item,
    name:
      item.name === 'Other'
        ? item.name
        : `${item.name} CPU${item.name !== '1' ? 's' : ''}`,
    details: item.details?.map((detail) => {
      const [count, nodes] = detail.split(':')
      return `${count} CPU${count !== '1' ? 's' : ''}:${nodes}`
    })
  }))
}

const processOsData = (stats: SystemStats): ChartDataItem[] => {
  if (!stats?.operatingSystems) return []
  return processChartData(stats.operatingSystems, 3)
}

const processCpuArchData = (stats: SystemStats): ChartDataItem[] => {
  if (!stats?.cpuArchitectures) return []
  const data = processChartData(stats.cpuArchitectures, 3)

  return data.map((item) => ({
    ...item,
    name: item.name.toUpperCase(),
    details: item.details?.map((detail) => detail.toUpperCase())
  }))
}

export default function HomePage() {
  const { systemStats, setTableType } = useDataContext()

  useEffect(() => {
    setTableType('countries')
  }, [setTableType])

  return (
    <div className={styles.root}>
      <HeroSection title="Ocean Nodes at a Glance" />
      <Map />
      <div className={styles.pieCharts}>
        <PieChartCard data={processCpuData(systemStats)} title="CPU Cores Distribution" />
        <PieChartCard data={processOsData(systemStats)} title="Operating Systems" />
        <PieChartCard data={processCpuArchData(systemStats)} title="CPU Architecture" />
      </div>
      <TopCountriesChart />
    </div>
  )
}
