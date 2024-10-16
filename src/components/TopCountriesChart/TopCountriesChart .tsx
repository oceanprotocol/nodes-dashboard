import React from 'react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer } from 'recharts'
import styles from './TopCountriesChart.module.css'

interface TopCountriesChartProps {
  data: { country: string; nodes: number }[]
}

const TopCountriesChart: React.FC<TopCountriesChartProps> = ({ data }) => {
  return (
    <div className={styles.root}>
      <h2 className={styles.title}>Top 5 countries by Ocean Nodes</h2>
      <p className={styles.description}>
        Lorem ipsum dolor sit amet, consectetur adipiscing elit.
      </p>
      <div className={styles.container}>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={data}
            layout="vertical"
            barSize={35}
            margin={{ left: 100, right: 20, top: 20, bottom: 20 }}
          >
            <XAxis
              type="number"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#CF1FB1', fontSize: 12 }}
              domain={[0, 10000]}
              ticks={[0, 2500, 5000, 7500, 10000]}
            />
            <YAxis
              dataKey="country"
              type="category"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#2D3748', fontSize: 14 }}
            />
            <defs>
              <linearGradient
                id="barGradient"
                x1="0"
                y1="0"
                x2="100%"
                y2="0"
                spreadMethod="reflect"
              >
                <stop offset="0%" stopColor="#0E001A" />
                <stop offset="50%" stopColor="#CF1FB1" />
                <stop offset="100%" stopColor="#DA4A8C" />
              </linearGradient>
            </defs>
            <Bar dataKey="nodes" radius={[0, 10, 10, 0]} fill="url(#barGradient)" />
          </BarChart>
        </ResponsiveContainer>
        <button className={styles.viewAll}>VIEW ALL</button>
      </div>
    </div>
  )
}

export default TopCountriesChart
