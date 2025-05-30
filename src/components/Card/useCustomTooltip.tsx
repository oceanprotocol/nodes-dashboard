import { useState, useEffect, useRef, useCallback } from 'react'
import ReactDOM from 'react-dom'
import React from 'react'

interface UseCustomTooltipProps {
  cardTitle: string
}

const RechartsTooltipContent = ({
  active,
  payload,
  label,
  cardIdRef,
  setTooltipInfo,
  mousePositionRef
}: any) => {
  const prevActiveRef = useRef(active)
  const prevPayloadRef = useRef(payload)

  useEffect(() => {
    if (
      prevActiveRef.current !== active ||
      (active && JSON.stringify(prevPayloadRef.current) !== JSON.stringify(payload))
    ) {
      prevActiveRef.current = active
      prevPayloadRef.current = payload

      if (active && payload && payload.length) {
        ;(window as any).__activeTooltipCard = cardIdRef.current
        const data = payload[0]

        queueMicrotask(() => {
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
        })
      } else {
        if ((window as any).__activeTooltipCard === cardIdRef.current) {
          ;(window as any).__activeTooltipCard = null
          queueMicrotask(() => {
            setTooltipInfo((prev: any) => ({ ...prev, show: false }))
          })
        }
      }
    }
  }, [active, payload, label, cardIdRef, setTooltipInfo, mousePositionRef])

  return null
}

export const useCustomTooltip = ({ cardTitle }: UseCustomTooltipProps) => {
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
  const cardIdRef = useRef(`tooltip-card-${Math.random().toString(36).substring(2, 9)}`)

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    mousePositionRef.current = { x: e.clientX, y: e.clientY }
  }, [])

  const handleMouseLeave = useCallback(() => {
    if ((window as any).__activeTooltipCard === cardIdRef.current) {
      ;(window as any).__activeTooltipCard = null
      setTooltipInfo((prev) => ({ ...prev, show: false }))
    }
  }, [])

  const CustomRechartsTooltipComponent = useCallback(
    (props: any) => (
      <RechartsTooltipContent
        {...props}
        cardIdRef={cardIdRef}
        setTooltipInfo={setTooltipInfo}
        mousePositionRef={mousePositionRef}
      />
    ),
    [cardIdRef, setTooltipInfo, mousePositionRef]
  )

  const renderTooltipPortal = useCallback(() => {
    if (!tooltipInfo.show || !tooltipInfo.data) return null

    const data = tooltipInfo.data.payload
    const value = tooltipInfo.data.value
    let tooltipContent: React.ReactNode

    if (cardTitle === 'Rewards History') {
      tooltipContent = (
        <React.Fragment>
          <div style={{ color: '#9F8FA6' }}>
            Step: {Number(data.weeklyAmount || 0).toLocaleString()} ROSE
          </div>
          <div style={{ color: '#CF1FB1' }}>
            Total: {Number(value).toLocaleString()} ROSE
          </div>
        </React.Fragment>
      )
    } else if (cardTitle === 'Average Incentive') {
      tooltipContent = (
        <React.Fragment>
          <div style={{ color: '#9F8FA6' }}>
            Total Rewards: {Number(data.totalRewards || 0).toLocaleString()} ROSE
          </div>
          <div style={{ color: '#9F8FA6' }}>
            Total Eligible Nodes: {Number(data.totalNodes || 0).toLocaleString()}
          </div>
          <div style={{ color: '#CF1FB1' }}>
            Average: {Number(value).toLocaleString()} ROSE/node
          </div>
        </React.Fragment>
      )
    } else if (cardTitle === 'Eligible Nodes per Epoch') {
      tooltipContent = (
        <React.Fragment>
          <div style={{ color: '#9F8FA6' }}>Epoch: {data.date.replace('Epoch ', '')}</div>
          <div style={{ color: '#CF1FB1' }}>
            Eligible Nodes: {Number(data?.foreground?.value || 0).toLocaleString()}
          </div>
          {typeof data.totalAmount === 'number' && (
            <div style={{ color: '#CF1FB1' }}>
              Total Nodes: {Number(data.totalAmount).toLocaleString()}
            </div>
          )}
        </React.Fragment>
      )
    } else if (cardTitle === 'Total Rewards') {
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
  }, [tooltipInfo, cardTitle])

  return {
    handleMouseMove,
    handleMouseLeave,
    CustomRechartsTooltipComponent,
    renderTooltipPortal
  }
}
