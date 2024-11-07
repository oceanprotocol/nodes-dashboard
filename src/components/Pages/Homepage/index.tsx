import dynamic from 'next/dynamic'

import styles from './style.module.css'

import PieChartCard from '../../PieChart/PieChart'
import HeroSection from '../../HeroSection/HeroSection'
import { useDataContext } from '../../../context/DataContext'

const Map = dynamic(() => import('../../Map'), { ssr: false })

interface SystemStats {
  cpuCounts: { [key: string]: number }
  operatingSystems: { [key: string]: number }
  cpuArchitectures: { [key: string]: number }
}

const processCpuData = (stats: SystemStats) => {
  if (!stats?.cpuCounts) return []

  const cpuColors = {
    '32': '#ff4092', // brand-pink
    '16': '#7b1173', // brand-purple
    '8': '#bd2881', // brand-purple-light
    '4': '#d53288', // brand-magenta
    '2': '#fe4796', // brand-raspberry-pink
    '1': '#e000cf', // brand-violet
    other: '#f7f7f7' // brand-grey-dimmed
  }

  return Object.entries(stats.cpuCounts).map(([cpuCount, count]) => ({
    name: `${cpuCount} CPU${cpuCount !== '1' ? 's' : ''}`,
    value: count,
    color: cpuColors[cpuCount as keyof typeof cpuColors] || cpuColors.other
  }))
}

const processOsData = (stats: SystemStats) => {
  if (!stats?.operatingSystems) return []

  const osColors = {
    Linux: '#7b1173', // brand-purple
    Darwin: '#bd2881', // brand-purple-light
    Windows: '#fe4796', // brand-raspberry-pink
    other: '#f7f7f7' // brand-grey-dimmed
  }

  return Object.entries(stats.operatingSystems).map(([os, count]) => ({
    name: os,
    value: count,
    color: osColors[os as keyof typeof osColors] || osColors.other
  }))
}

const processCpuArchData = (stats: SystemStats) => {
  if (!stats?.cpuArchitectures) return []

  const archColors = {
    x64: '#ff4092', // brand-pink
    arm64: '#7b1173', // brand-purple
    arm: '#bd2881', // brand-purple-light
    other: '#f7f7f7' // brand-grey-dimmed
  }

  return Object.entries(stats.cpuArchitectures).map(([arch, count]) => ({
    name: arch.toUpperCase(),
    value: count,
    color: archColors[arch as keyof typeof archColors] || archColors.other
  }))
}

export default function HomePage() {
  const { systemStats } = useDataContext()

  return (
    <div className={styles.root}>
      <HeroSection title="Ocean Nodes at a Glance" />
      <Map />
      <div className={styles.pieCharts}>
        <PieChartCard data={processCpuData(systemStats)} title="CPU Cores Distribution" />
        <PieChartCard data={processOsData(systemStats)} title="Operating Systems" />
        <PieChartCard data={processCpuArchData(systemStats)} title="CPU Architecture" />
      </div>
    </div>
  )
}
