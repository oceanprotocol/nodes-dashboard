import React, { useState, useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from 'recharts'
import styles from './PieChartCard.module.css'

interface PieChartCardProps {
  data: { name: string; value: number; color: string }[]
  title: string
}

const PieChartCard: React.FC<PieChartCardProps> = ({ data, title }) => {
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined)
  const [hoverText, setHoverText] = useState('Hover to see details')

  const totalValue = useMemo(
    () => data.reduce((sum, entry) => sum + entry.value, 0),
    [data]
  )

  const onPieEnter = (_: any, index: number) => {
    setActiveIndex(index)
    const percentage = ((data[index].value / totalValue) * 100).toFixed(2)
    setHoverText(`${data[index].name}: ${percentage}%`)
  }

  const onPieLeave = () => {
    setActiveIndex(undefined)
    setHoverText('Hover to see details')
  }

  const renderActiveShape = (props: any) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props
    return (
      <g>
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="6" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <Sector
          cx={cx}
          cy={cy}
          innerRadius={innerRadius}
          outerRadius={outerRadius + 15}
          startAngle={startAngle}
          endAngle={endAngle}
          fill={fill}
          filter="url(#glow)"
        />
      </g>
    )
  }

  return (
    <div className={styles.card}>
      <h3>{title}</h3>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            activeIndex={activeIndex}
            activeShape={renderActiveShape}
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={90}
            paddingAngle={0}
            dataKey="value"
            onMouseEnter={onPieEnter}
            onMouseLeave={onPieLeave}
            className={styles.pieHover}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color}
                stroke="none"
                style={{
                  transition: 'all 0.3s ease-in-out',
                  filter: activeIndex === index ? 'url(#glow)' : 'none'
                }}
              />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <p className={styles.tapToSee}>{hoverText}</p>
    </div>
  )
}

export default PieChartCard
