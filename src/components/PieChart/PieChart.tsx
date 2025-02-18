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
  const [lockedIndex, setLockedIndex] = useState<number | undefined>(undefined)
  const [hoverText, setHoverText] = useState('Hover to see details')

  const totalValue = useMemo(
    () => data.reduce((sum, entry) => sum + entry.value, 0),
    [data]
  )

  const onPieEnter = (_: any, index: number) => {
    if (lockedIndex === undefined) {
      setActiveIndex(index)
      const percentage = ((data[index].value / totalValue) * 100).toFixed(2)
      setHoverText(`${data[index].name}: ${percentage}%`)
    }
  }

  const onPieLeave = () => {
    if (lockedIndex === undefined) {
      setActiveIndex(undefined)
      setHoverText('Hover to see details')
    }
  }

  const onPieClick = (_: any, index: number) => {
    if (lockedIndex === index) {
      setLockedIndex(undefined)
      setActiveIndex(undefined)
      setHoverText('Hover to see details')
    } else {
      setLockedIndex(index)
      setActiveIndex(index)
      const percentage = ((data[index].value / totalValue) * 100).toFixed(2)
      setHoverText(`${data[index].name}: ${percentage}%`)
    }
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
    const isActive = active || lockedIndex !== undefined
    let item
    if (lockedIndex !== undefined) {
      item = data[lockedIndex]
    } else if (payload && payload.length > 0) {
      item = payload[0].payload
    }
    if (isActive && item) {
      const percentage = ((item.value / totalValue) * 100).toFixed(1)
      return (
        <div
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            padding: '8px',
            borderRadius: '4px',
            color: '#000'
          }}
        >
          <p style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>{item.name}</p>
          <p style={{ margin: '0 0 8px 0' }}>
            Total: {item.value} nodes ({percentage}%)
          </p>
          {item.details && (
            <div
              style={{
                fontSize: '12px',
                height: '150px',
                overflowY: 'auto',
                borderTop: '1px solid #eee',
                paddingTop: '8px',
                pointerEvents: 'auto'
              }}
            >
              {Array.isArray(item.details) &&
                item.details.map((detail: string, index: number) => (
                  <div key={index}>
                    <p style={{ margin: '2px 0' }}>{detail}</p>
                  </div>
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
            onClick={onPieClick}
            className={styles.pieHover}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color}
                stroke="none"
                style={{
                  transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                  filter:
                    activeIndex === index || lockedIndex === index
                      ? 'url(#glow)'
                      : 'none',
                  transform:
                    activeIndex === index || lockedIndex === index
                      ? 'scale(1.05)'
                      : 'scale(1)'
                }}
              />
            ))}
          </Pie>
          <Tooltip
            active={lockedIndex !== undefined ? true : undefined}
            content={<CustomTooltip />}
            position={{ y: 250 }}
            wrapperStyle={{
              transition: 'opacity 0.3s ease-in-out',
              opacity: activeIndex !== undefined || lockedIndex !== undefined ? 1 : 0,
              zIndex: 1000
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div style={{ textAlign: 'center', marginTop: '8px' }}>{hoverText}</div>
    </div>
  )
}

export default PieChartCard
