import React from 'react'
import styles from './Card.module.css'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  Area,
  ResponsiveContainer,
  XAxis,
  Tooltip
} from 'recharts'

interface CardProps {
  title: string
  chartType?: 'bar' | 'line'
  chartData?: Array<{
    date: string
    background?: { value: number }
    foreground?: { value: number }
    value?: number
  }>
  bigNumber?: string | number
  subText?: string
  additionalInfo?: React.ReactNode
  isLoading?: boolean
  dataLoading?: boolean
}

const CustomBar = (props: any) => {
  const { x, y, width, height, foregroundValue, backgroundValue } = props
  const gapWidth = 3
  const barWidth = width - gapWidth
  const radius = 3

  const totalHeight = backgroundValue
  const foregroundHeight = (foregroundValue / totalHeight) * height
  const backgroundHeight = height - foregroundHeight

  return (
    <g>
      <path
        d={`
          M${x},${y + height}
          L${x},${y + backgroundHeight + radius}
          Q${x},${y + backgroundHeight} ${x + radius},${y + backgroundHeight}
          L${x + barWidth - radius},${y + backgroundHeight}
          Q${x + barWidth},${y + backgroundHeight} ${x + barWidth},${y + backgroundHeight + radius}
          L${x + barWidth},${y + height}
          Z
        `}
        fill="url(#gradient)"
      />
      <path
        d={`
          M${x},${y + backgroundHeight}
          L${x},${y + radius}
          Q${x},${y} ${x + radius},${y}
          L${x + barWidth - radius},${y}
          Q${x + barWidth},${y} ${x + barWidth},${y + radius}
          L${x + barWidth},${y + backgroundHeight}
          Z
        `}
        fill="#E0E0E0"
      />
    </g>
  )
}

const Card: React.FC<CardProps> = ({
  title,
  chartType,
  chartData,
  bigNumber,
  subText,
  additionalInfo,
  isLoading = false,
  dataLoading = false
}) => {
  console.log('🚀 ~ chartData:', chartData)
  const formatNumber = (num: string | number) => {
    if (typeof num === 'string') return num

    if (num >= 1000 && num < 1000000) {
      return `${(num / 1000).toFixed(1)}K`
    }
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(2)}M`
    }
    return new Intl.NumberFormat('en-US').format(num)
  }

  return (
    <div className={`${styles.card} ${isLoading ? styles.cardLoading : ''}`}>
      <div className={styles.cardContent}>
        {isLoading ? (
          <>
            <div className={styles.cardTitle} aria-hidden="true" />
            <div className={styles.bigNumber} aria-hidden="true" />
            {chartType && <div className={styles.chartSkeleton} aria-hidden="true" />}
            {subText && <div className={styles.subText} aria-hidden="true" />}
          </>
        ) : (
          <>
            <h3 className={styles.cardTitle}>{title}</h3>
            {dataLoading ? (
              <div className={styles.dataLoading} aria-hidden="true" />
            ) : (
              <>
                {chartType === 'bar' && chartData && (
                  <ResponsiveContainer width="100%" height={100}>
                    <BarChart data={chartData} barSize={15}>
                      <defs>
                        <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#CF1FB1" />
                          <stop offset="100%" stopColor="#DA4A8C" />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" hide />
                      <Bar
                        dataKey="background.value"
                        shape={(props: any) => (
                          <CustomBar
                            {...props}
                            foregroundValue={props.payload.foreground.value}
                            backgroundValue={props.payload.background.value}
                          />
                        )}
                      />
                      <Tooltip />
                    </BarChart>
                  </ResponsiveContainer>
                )}
                {chartType === 'line' && chartData && chartData.length > 0 && (
                  <ResponsiveContainer
                    width="100%"
                    height={200}
                    style={{ paddingTop: '50px' }}
                  >
                    <LineChart data={chartData}>
                      <defs>
                        <linearGradient id="lineWave" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#CF1FB1" stopOpacity={1} />
                          <stop offset="100%" stopColor="#CF1FB1" stopOpacity={0.2} />
                        </linearGradient>
                        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                          <feGaussianBlur in="SourceAlpha" stdDeviation="4" />
                          <feOffset dx="0" dy="4" result="offsetblur" />
                          <feComponentTransfer>
                            <feFuncA type="linear" slope="0.2" />
                          </feComponentTransfer>
                          <feMerge>
                            <feMergeNode />
                            <feMergeNode in="SourceGraphic" />
                          </feMerge>
                        </filter>
                      </defs>
                      <Line
                        type="basis"
                        dataKey="foreground.value"
                        stroke="url(#lineWave)"
                        strokeWidth={3}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        dot={false}
                        activeDot={{
                          r: 8,
                          fill: '#CF1FB1',
                          stroke: '#ffffff',
                          strokeWidth: 2
                        }}
                        filter="url(#shadow)"
                      />
                      <Area
                        type="basis"
                        dataKey="foreground.value"
                        fill="url(#lineWave)"
                        strokeWidth={0}
                        opacity={0.1}
                      />
                      <Tooltip
                        contentStyle={{
                          background: '#1A0820',
                          border: '1px solid #CF1FB1',
                          borderRadius: '8px',
                          boxShadow: '0 4px 20px rgba(207, 31, 177, 0.3)'
                        }}
                        formatter={(value) => [
                          <span key="value" style={{ color: '#CF1FB1' }}>
                            {Number(value).toLocaleString()} ROSE
                          </span>
                        ]}
                        labelFormatter={(label) => (
                          <span style={{ color: '#CF1FB1' }}>{label}</span>
                        )}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
                {bigNumber && (
                  <div className={styles.bigNumber}>{formatNumber(bigNumber)}</div>
                )}
                {subText && <p className={styles.subText}>{subText}</p>}
                {additionalInfo}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default Card
