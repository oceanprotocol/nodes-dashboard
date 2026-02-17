import { ChartTypeEnum } from '@/components/chart/chart-type';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';

type TooltipInfo = {
  show: boolean;
  x: number;
  y: number;
  data: any;
};

type UseCustomTooltipProps = {
  chartType?: ChartTypeEnum;
  labelKey: string;
};

const RechartsTooltipContent = ({ active, payload, label, cardIdRef, setTooltipInfo, mousePositionRef }: any) => {
  const prevActiveRef = useRef(active);
  const prevPayloadRef = useRef(payload);

  useEffect(() => {
    if (
      prevActiveRef.current !== active ||
      (active && JSON.stringify(prevPayloadRef.current) !== JSON.stringify(payload))
    ) {
      prevActiveRef.current = active;
      prevPayloadRef.current = payload;

      if (active && payload && payload.length) {
        (window as any).__activeTooltipCard = cardIdRef.current;
        const data = payload[0];

        queueMicrotask(() => {
          if ((window as any).__activeTooltipCard === cardIdRef.current) {
            setTooltipInfo({
              show: true,
              x: mousePositionRef.current.x,
              y: mousePositionRef.current.y,
              data: {
                value: data.value,
                payload: data.payload,
              },
            });
          }
        });
      } else {
        if ((window as any).__activeTooltipCard === cardIdRef.current) {
          (window as any).__activeTooltipCard = null;
          queueMicrotask(() => {
            setTooltipInfo((prev: any) => ({ ...prev, show: false }));
          });
        }
      }
    }
  }, [active, payload, label, cardIdRef, setTooltipInfo, mousePositionRef]);

  return null;
};

export const useCustomTooltip = ({ chartType, labelKey }: UseCustomTooltipProps) => {
  const [tooltipInfo, setTooltipInfo] = useState<TooltipInfo>({
    show: false,
    x: 0,
    y: 0,
    data: null,
  });

  const mousePositionRef = useRef({ x: 0, y: 0 });
  const cardIdRef = useRef(`tooltip-card-${Math.random().toString(36).substring(2, 9)}`);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    mousePositionRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseLeave = useCallback(() => {
    if ((window as any).__activeTooltipCard === cardIdRef.current) {
      (window as any).__activeTooltipCard = null;
      setTooltipInfo((prev) => ({ ...prev, show: false }));
    }
  }, []);

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
  );

  const renderTooltipPortal = useCallback(() => {
    if (!tooltipInfo.show || !tooltipInfo.data) return null;

    const payload = tooltipInfo.data.payload;
    const value = tooltipInfo.data.value;
    const label = payload[labelKey];

    let tooltipContent: React.ReactNode;

    switch (chartType) {
      case ChartTypeEnum.CPU_ARCH_DISTRIBUTION:
      case ChartTypeEnum.CPU_CORES_DISTRIBUTION:
      case ChartTypeEnum.OS_DISTRIBUTION: {
        tooltipContent = (
          <div>
            <p style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>{label}</p>
            <p style={{ margin: '0 0 8px 0' }}>Total: {value} nodes</p>
            {payload.details && (
              <div
                style={{
                  fontSize: '12px',
                  height: '150px',
                  overflowY: 'auto',
                  borderTop: '1px solid var(--border-glass)',
                  paddingTop: '8px',
                  pointerEvents: 'auto',
                }}
              >
                {Array.isArray(payload.details)
                  ? payload.details.map((detail: string, index: number) => (
                      <div key={index}>
                        <p style={{ margin: '2px 0' }}>{detail}</p>
                      </div>
                    ))
                  : null}
              </div>
            )}
          </div>
        );
        break;
      }
      case ChartTypeEnum.JOBS_PER_EPOCH: {
        tooltipContent = (
          <div>
            Epoch {label}: {Number(value).toLocaleString()} jobs
          </div>
        );
        break;
      }
      case ChartTypeEnum.REVENUE_PER_EPOCH: {
        tooltipContent = (
          <div>
            Epoch {label}: USDC {Number(value).toLocaleString()}
          </div>
        );
        break;
      }
      default: {
        tooltipContent = <div>Value: {Number(value).toLocaleString()}</div>;
      }
    }

    return ReactDOM.createPortal(
      <div
        style={{
          position: 'fixed',
          top: tooltipInfo.y + 10,
          left: tooltipInfo.x + 10,
          background: 'var(--background-glass)',
          backdropFilter: 'var(--backdrop-filter-glass)',
          boxShadow: 'var(--inner-shadow-glass), var(--drop-shadow-black)',
          borderRadius: '12px',
          color: 'var(--text-primary)',
          padding: '8px 16px',
          zIndex: 9999999,
          pointerEvents: 'none',
        }}
      >
        {tooltipContent}
      </div>,
      document.body
    );
  }, [tooltipInfo, chartType, labelKey /*cardTitle*/]);

  return {
    handleMouseMove,
    handleMouseLeave,
    CustomRechartsTooltipComponent,
    renderTooltipPortal,
  };
};
