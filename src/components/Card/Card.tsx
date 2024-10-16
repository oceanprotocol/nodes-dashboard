import React from 'react'
import styles from './Card.module.css'
import { BarChart, Bar, LineChart, Line, ResponsiveContainer } from 'recharts'

interface CardProps {
  title: string
  chartType?: 'bar' | 'line'
  chartData?: any[]
  bigNumber?: string | number
  subText?: string
  additionalInfo?: React.ReactNode
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
        {chartType === 'bar' && (
          <ResponsiveContainer width="100%" height={100}>
            <BarChart data={chartData}>
              <defs>
                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0E001A" stopOpacity={0.4} />
                  <stop offset="40%" stopColor="#CF1FB1" stopOpacity={0.4} />
                  <stop offset="40%" stopColor="#DA4A8C" stopOpacity={0.4} />
                </linearGradient>
              </defs>
              <Bar dataKey="value" fill="url(#barGradient)" />
            </BarChart>
          </ResponsiveContainer>
        )}
        {chartType === 'line' && (
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
