import React, { useState, useEffect, useRef } from 'react'
import styles from './Card.module.css'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  Area,
  ResponsiveContainer,
  XAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid
} from 'recharts'
import ReactDOM from 'react-dom'
import Image from 'next/image'
import InfoIcon from '@/assets/info.svg'
import { Tooltip } from '@mui/material'

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
  dataLoading = false,
  tooltip
}) => {
  const [tooltipInfo, setTooltipInfo] = useState<{
    show: boolean
    x: number
    y: number
    data: any
  }>({
    show: false,
    x: 0,
    y: 0,
    data: null
  })

  const mousePositionRef = useRef({ x: 0, y: 0 })

  const handleMouseMove = (e: React.MouseEvent) => {
    mousePositionRef.current = { x: e.clientX, y: e.clientY }
  }

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

  const CustomTooltip = ({ active, payload, label }: any) => {
    const prevActiveRef = useRef(active)
    const prevPayloadRef = useRef(payload)
    const cardIdRef = useRef(`card-${Math.random().toString(36).substring(2, 9)}`)

    useEffect(() => {
      if (
        prevActiveRef.current !== active ||
        (active && JSON.stringify(prevPayloadRef.current) !== JSON.stringify(payload))
      ) {
        prevActiveRef.current = active
        prevPayloadRef.current = payload

        if (active && payload && payload.length) {
          const data = payload[0]

          ;(window as any).__activeTooltipCard = cardIdRef.current

          setTimeout(() => {
            if ((window as any).__activeTooltipCard === cardIdRef.current) {
              setTooltipInfo({
                show: true,
                x: mousePositionRef.current.x,
                y: mousePositionRef.current.y,
                data: {
                  value: data.value,
                  payload: data.payload
                }
              })
            }
          }, 0)
        } else {
          if ((window as any).__activeTooltipCard === cardIdRef.current) {
            ;(window as any).__activeTooltipCard = null

            setTimeout(() => {
              setTooltipInfo((prev) => ({ ...prev, show: false }))
            }, 0)
          }
        }
      }
    }, [active, payload, label])

    return null
  }

  const renderTooltip = () => {
    if (!tooltipInfo.show || !tooltipInfo.data) return null

    const data = tooltipInfo.data.payload
    const value = tooltipInfo.data.value

    let tooltipContent

    if (title === 'Rewards History') {
      tooltipContent = (
        <>
          <div style={{ color: '#9F8FA6' }}>
            Step: {Number(data.weeklyAmount || 0).toLocaleString()} ROSE
          </div>
          <div style={{ color: '#CF1FB1' }}>
            Total: {Number(value).toLocaleString()} ROSE
          </div>
        </>
      )
    } else if (title === 'Average Incentive') {
      tooltipContent = (
        <>
          <div style={{ color: '#9F8FA6' }}>
            Total Rewards: {Number(data.totalRewards || 0).toLocaleString()} ROSE
          </div>
          <div style={{ color: '#9F8FA6' }}>
            Total Eligible Nodes: {Number(data.totalNodes || 0).toLocaleString()}
          </div>
          <div style={{ color: '#CF1FB1' }}>
            Average: {Number(value).toLocaleString()} ROSE/node
          </div>
        </>
      )
    } else if (title === 'Eligible Nodes per Round') {
      tooltipContent = (
        <>
          <div style={{ color: '#9F8FA6' }}>Round: {data.date.replace('Round ', '')}</div>
          <div style={{ color: '#CF1FB1' }}>
            Eligible Nodes: {Number(data?.foreground?.value || 0).toLocaleString()}
          </div>
          {typeof data.totalAmount === 'number' && (
            <div style={{ color: '#CF1FB1' }}>
              Total Nodes: {Number(data.totalAmount).toLocaleString()}
            </div>
          )}
        </>
      )
    } else if (title === 'Total Rewards') {
      tooltipContent = (
        <div style={{ color: '#CF1FB1' }}>
          Total Rewards: {Number(value).toLocaleString()} ROSE
        </div>
      )
    } else {
      tooltipContent = (
        <div style={{ color: '#CF1FB1' }}>Value: {Number(value).toLocaleString()}</div>
      )
    }

    return ReactDOM.createPortal(
      <div
        style={{
          position: 'fixed',
          top: tooltipInfo.y + 10,
          left: tooltipInfo.x + 10,
          backgroundColor: '#1A0820',
          border: '1px solid rgba(207, 31, 177, 0.3)',
          borderRadius: '8px',
          boxShadow: '0 4px 20px rgba(207, 31, 177, 0.3)',
          padding: '8px 12px',
          zIndex: 9999999,
          pointerEvents: 'none'
        }}
      >
        {tooltipContent}
      </div>,
      document.body
    )
  }

  const handleMouseLeave = () => {
    setTooltipInfo((prev) => ({ ...prev, show: false }))
    ;(window as any).__activeTooltipCard = null
  }

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
                        <RechartsTooltip content={<CustomTooltip />} cursor={false} />
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
                        <RechartsTooltip content={<CustomTooltip />} cursor={false} />
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

      {renderTooltip()}
    </div>
  )
}

export default Card
