import React from 'react'
import styles from './Card.module.css'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid
} from 'recharts'
import Image from 'next/image'
import InfoIcon from '@/assets/info.svg'
import { Tooltip } from '@mui/material'
import { useCustomTooltip } from '@/components/Card/useCustomTooltip'
import { formatNumber } from '@/utils/formatters'
import CustomBar from '@/components/CustomBar/CustomBar'

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
  subText?: React.ReactNode
  additionalInfo?: React.ReactNode
  isLoading?: boolean
  dataLoading?: boolean
  tooltip?: string
}

const Card: React.FC<CardProps> = ({
  title,
  chartType,
  chartData,
  bigNumber,
  subText,
  additionalInfo,
  isLoading = false,
  dataLoading = false,
  tooltip
}) => {
  const {
    handleMouseMove,
    handleMouseLeave,
    CustomRechartsTooltipComponent,
    renderTooltipPortal
  } = useCustomTooltip({ cardTitle: title })

  return (
    <div
      className={`${styles.card} ${isLoading ? styles.cardLoading : ''}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
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
            <div className={styles.titleContainer}>
              <h3 className={styles.cardTitle}>{title}</h3>
              {tooltip && (
                <Tooltip
                  title={tooltip}
                  arrow
                  placement="top"
                  sx={{
                    '& .MuiTooltip-tooltip': {
                      backgroundColor: '#1A0820',
                      color: 'white',
                      fontSize: '0.8rem',
                      padding: '8px 12px',
                      maxWidth: 300,
                      border: '1px solid rgba(207, 31, 177, 0.3)',
                      boxShadow: '0 4px 20px rgba(207, 31, 177, 0.3)'
                    },
                    '& .MuiTooltip-arrow': {
                      color: '#1A0820'
                    }
                  }}
                >
                  <div className={styles.tooltipIcon}>
                    <Image src={InfoIcon} alt="info" width={16} height={16} />
                  </div>
                </Tooltip>
              )}
            </div>
            {dataLoading ? (
              <div className={styles.dataLoading} aria-hidden="true" />
            ) : (
              <>
                {chartType === 'bar' && chartData && (
                  <div className={styles.chartContainer}>
                    <ResponsiveContainer width="100%" height="85%">
                      <BarChart
                        data={chartData}
                        barSize={8}
                        margin={{ top: 10, right: 5, bottom: 5, left: 5 }}
                      >
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
                              foregroundValue={props.payload.foreground?.value || 0}
                              backgroundValue={props.payload.background?.value || 0}
                            />
                          )}
                        />
                        <RechartsTooltip
                          content={<CustomRechartsTooltipComponent />}
                          cursor={false}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {chartType === 'line' && chartData && chartData.length > 0 && (
                  <div className={styles.chartContainer}>
                    <ResponsiveContainer width="100%" height="85%">
                      <LineChart
                        data={chartData}
                        margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
                      >
                        <defs>
                          <linearGradient id="lineWave" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor="#7b1173" stopOpacity={0.8} />
                            <stop offset="30%" stopColor="#bd2881" stopOpacity={0.6} />
                            <stop offset="60%" stopColor="#CF1FB1" stopOpacity={1} />
                          </linearGradient>
                          <filter
                            id="shadow"
                            x="-50%"
                            y="-50%"
                            width="200%"
                            height="200%"
                          >
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
                        <CartesianGrid opacity={0} />
                        <XAxis hide />
                        <Line
                          type="monotone"
                          dataKey="foreground.value"
                          stroke="#CF1FB1"
                          strokeWidth={2}
                          dot={false}
                          activeDot={{
                            r: 6,
                            fill: '#CF1FB1',
                            stroke: '#ffffff',
                            strokeWidth: 2
                          }}
                        />
                        <RechartsTooltip
                          content={<CustomRechartsTooltipComponent />}
                          cursor={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {bigNumber && (
                  <div className={styles.bigNumber}>{formatNumber(bigNumber)}</div>
                )}
                {additionalInfo}
                {subText && <p className={styles.subText}>{subText}</p>}
              </>
            )}
          </>
        )}
      </div>

      {renderTooltipPortal()}
    </div>
  )
}

export default Card
