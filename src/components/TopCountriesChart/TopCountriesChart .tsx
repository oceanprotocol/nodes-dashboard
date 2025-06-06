import React from 'react'
import Link from 'next/link'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, CartesianGrid } from 'recharts'
import styles from './TopCountriesChart.module.css'
import { getRoutes } from '../../config'
import { useCountriesContext } from '@/context/CountriesContext'
import { CountryStatsType } from '@/shared/types/dataTypes'

const TopCountriesChart: React.FC = () => {
  const routes = getRoutes()
  const { data: countryStats } = useCountriesContext()

  const topCountries = countryStats.slice(0, 5).map((stat: CountryStatsType) => ({
    country: stat.country,
    nodes: stat.totalNodes
  }))

  const maxNodes = Math.max(...topCountries.map((country) => country.nodes))

  const tickInterval = maxNodes > 50000 ? 5000 : 1000
  const roundedMax = Math.ceil(maxNodes / tickInterval) * tickInterval
  const tickValues = Array.from({ length: 6 }, (_, i) => Math.round((roundedMax / 5) * i))

  return (
    <div className={styles.root}>
      <h2 className={styles.title}>Top 5 countries by Ocean Nodes</h2>
      <div className={styles.container}>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={topCountries}
            layout="vertical"
            margin={{ left: 20, right: 20, top: 20, bottom: 20 }}
          >
            <XAxis
              dataKey="nodes"
              type="number"
              axisLine={false}
              tickLine={false}
              tick={<CustomXAxisTick />}
              domain={[0, roundedMax]}
              ticks={tickValues}
            />
            <YAxis
              dataKey="country"
              type="category"
              axisLine={false}
              tickLine={false}
              width={80}
            />
            <defs>
              <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#4A0072" />
                <stop offset="60%" stopColor="#CF1FB1" />
                <stop offset="100%" stopColor="#CF1FB1" />
              </linearGradient>
            </defs>
            <Bar
              dataKey="nodes"
              radius={[0, 10, 10, 0]}
              fill="url(#barGradient)"
              barSize={30}
            />
            <CartesianGrid vertical={false} horizontal={true} strokeOpacity={0.5} />
          </BarChart>
        </ResponsiveContainer>
        <Link href={routes.countries.path} className={styles.viewAll}>
          VIEW ALL
        </Link>
      </div>
    </div>
  )
}

const CustomXAxisTick = (props: any) => {
  const { x, y, payload } = props
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={16} textAnchor="middle" fill="#666" fontSize={12}>
        {payload.value}
      </text>
      <line
        x1={0}
        y1={-30}
        x2={0}
        y2={-280}
        stroke="#E0E0E0"
        strokeDasharray="3 3"
        strokeOpacity={0.5}
      />
    </g>
  )
}

export default TopCountriesChart
