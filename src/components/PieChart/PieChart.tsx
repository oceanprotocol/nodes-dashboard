import React from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import styles from './PieChartCard.module.css'

interface PieChartCardProps {
  data: { name: string; value: number; color: string }[]
  title: string
}

const PieChartCard: React.FC<PieChartCardProps> = ({ data, title }) => {
  return (
    <div className={styles.card}>
      <h3>{title}</h3>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <p className={styles.tapToSee}>Tap to see details</p>
    </div>
  )
}

export default PieChartCard
