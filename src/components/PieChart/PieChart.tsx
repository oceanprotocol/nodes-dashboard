import React, { useState, useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Sector, Tooltip } from 'recharts'
import styles from './PieChartCard.module.css'

interface PieChartCardProps {
  data: {
    name: string
    value: number
    color: string
    details?: string[]
  }[]
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

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const { name, value, details } = payload[0].payload
      const percentage = ((value / totalValue) * 100).toFixed(1)

      return (
        <div
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            padding: '8px',
            borderRadius: '4px',
            color: '#000'
          }}
        >
          <p style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>{name}</p>
          <p style={{ margin: '0 0 8px 0' }}>
            Total: {value} nodes ({percentage}%)
          </p>
          {details && (
            <div
              style={{
                fontSize: '12px',
                maxHeight: '150px',
                overflowY: 'auto',
                borderTop: '1px solid #eee',
                paddingTop: '8px'
              }}
            >
              {Array.isArray(details) &&
                details.map((detail: string, index: number) => (
                  <p key={index} style={{ margin: '2px 0' }}>
                    {detail}
                  </p>
                ))}
            </div>
          )}
        </div>
      )
    }
    return null
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
                  transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                  filter: activeIndex === index ? 'url(#glow)' : 'none',
                  transform: activeIndex === index ? 'scale(1.05)' : 'scale(1)'
                }}
              />
            ))}
          </Pie>
          <Tooltip
            content={<CustomTooltip />}
            position={{ y: 250 }}
            wrapperStyle={{
              transition: 'opacity 0.3s ease-in-out',
              opacity: activeIndex !== undefined ? 1 : 0,
              zIndex: 1000
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <p className={styles.tapToSee}>{hoverText}</p>
    </div>
  )
}

export default PieChartCard
