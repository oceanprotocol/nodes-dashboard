import React from 'react'
import styles from './Card.module.css'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
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
}

const getStrokeColor = ({ channel }: { channel: string }) => {
  return channel === 'foreground' ? 'url(#gradient)' : '#E0E0E0'
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
  additionalInfo
}) => {
  return (
    <div className={styles.card}>
      <h3 className={styles.cardTitle}>{title}</h3>
      <div className={styles.cardContent}>
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
        {chartType === 'line' && chartData && (
          <ResponsiveContainer width="100%" height={100}>
            <LineChart data={chartData}>
              <defs>
                <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="20%" stopColor="#CF1FB1" stopOpacity={1} />
                </linearGradient>
              </defs>
              <Line
                type="monotone"
                dataKey="value"
                stroke="url(#lineGradient)"
                strokeWidth={2}
                dot={false}
              />
              <Tooltip />
            </LineChart>
          </ResponsiveContainer>
        )}
        {bigNumber && <div className={styles.bigNumber}>{bigNumber}</div>}
        {subText && <p className={styles.subText}>{subText}</p>}
        {additionalInfo}
      </div>
    </div>
  )
}

export default Card
