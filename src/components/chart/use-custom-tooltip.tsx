import { ChartTypeEnum } from '@/components/chart/chart-type';
import config from '@/config';
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

const EpochLabel: React.FC<{
  children: React.ReactNode;
  epoch: number;
}> = ({ children, epoch }) => {
  const onEpoch = epoch - config.epochDiff;
  return (
    <div>
      <div>
        {onEpoch < 1 ? <span>ON Testing Phase</span> : <span>ON Epoch {onEpoch.toLocaleString()}</span>}
        :&nbsp;
        <span>{children}</span>
      </div>
      <div className="text10 textSecondary">Unix epoch {epoch.toLocaleString()}</div>
    </div>
  );
};

/**
 * Whether a point is within an element's box, with 2px of slack on each edge — the pointer crossing
 * the gap between the plot and the tooltip can sample a coordinate that belongs to neither.
 *
 * A coordinate test, not a pointer-event one: most of these tooltips render with
 * `pointerEvents: 'none'`, so they receive no mouseenter/mouseleave of their own and their hover
 * state can only be derived from the cursor position.
 */
const containsPoint = (el: HTMLElement | null, x: number, y: number, slack = 2) => {
  if (!el) {
    return false;
  }
  const box = el.getBoundingClientRect();
  if (box.width === 0 && box.height === 0) {
    return false;
  }
  return x >= box.left - slack && x <= box.right + slack && y >= box.top - slack && y <= box.bottom + slack;
};

const RechartsTooltipContent = ({
  active,
  payload,
  label,
  cardIdRef,
  setTooltipInfo,
  mousePositionRef,
  tooltipElementRef,
}: any) => {
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
        // Recharts deactivates as soon as the pointer leaves the plot — including when it leaves by
        // moving ONTO the tooltip. Some tooltips are interactive (the distribution charts hold a
        // scrollable node list), so hiding here would make them unreachable. When the cursor is over
        // the tooltip, leave it up and let the document-level guard own dismissal.
        const { x, y } = mousePositionRef.current;
        if (containsPoint(tooltipElementRef?.current, x, y)) {
          return;
        }
        if ((window as any).__activeTooltipCard === cardIdRef.current) {
          (window as any).__activeTooltipCard = null;
          queueMicrotask(() => {
            setTooltipInfo((prev: any) => ({ ...prev, show: false }));
          });
        }
      }
    }
  }, [active, payload, label, cardIdRef, setTooltipInfo, mousePositionRef, tooltipElementRef]);

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
  // The element wrapping the plot, so dismissal can be decided from the pointer's real position
  // rather than from which element it happened to leave (see the document listener below).
  const plotRef = useRef<HTMLDivElement | null>(null);
  // The portalled tooltip itself. Some tooltips are interactive — the distribution charts put a
  // scrollable list of nodes inside one (`pointerEvents: 'auto'`) — so the pointer being over the
  // tooltip counts as being "in" the chart, and must not dismiss it.
  const tooltipElementRef = useRef<HTMLDivElement | null>(null);

  const hide = useCallback(() => {
    if ((window as any).__activeTooltipCard === cardIdRef.current) {
      (window as any).__activeTooltipCard = null;
    }
    setTooltipInfo((prev) => (prev.show ? { ...prev, show: false } : prev));
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    mousePositionRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  /**
   * Deliberately does NOT dismiss. Leaving the wrapper also happens when the pointer moves into the
   * portalled tooltip (it lives on document.body, so it is outside the wrapper) — hiding here would
   * kill the interactive tooltips before they can be entered. Dismissal is owned entirely by the
   * document-level hit test below, which keeps the tooltip alive while the pointer is over it.
   */
  const handleMouseLeave = useCallback(() => {}, []);

  /**
   * Dismiss whenever the pointer is outside the plot, judged by coordinates on every document-level
   * move — not by a mouseleave on any particular element.
   *
   * Neither of the two existing dismissal paths covers leaving THROUGH the tooltip. The plot is a
   * short band (110px) inside a taller wrapper, and the tooltip is portalled to document.body at
   * cursor+10px, so moving up off a bar exits the plot while staying inside the wrapper: recharts
   * stops updating `active` (the pointer is off its surface) and `onMouseLeave` never fires (the
   * wrapper was never left). The tooltip then stuck until the next hover.
   *
   * Bound only while something is shown, so there is no idle global listener per chart.
   */
  useEffect(() => {
    if (!tooltipInfo.show) {
      return;
    }
    const onDocumentMouseMove = (e: MouseEvent) => {
      // Keep the position current even off the plot: the deactivation path in RechartsTooltipContent
      // hit-tests against it, and the chart's own onMouseMove stops firing once the pointer leaves.
      mousePositionRef.current = { x: e.clientX, y: e.clientY };
      if (!plotRef.current) {
        return;
      }
      // The tooltip counts as inside, so an interactive one can be entered and scrolled.
      if (
        containsPoint(plotRef.current, e.clientX, e.clientY) ||
        containsPoint(tooltipElementRef.current, e.clientX, e.clientY)
      ) {
        return;
      }
      hide();
    };
    // `mouseleave` on the window catches the pointer exiting the viewport entirely, where no further
    // mousemove would arrive to trigger the check above.
    document.addEventListener('mousemove', onDocumentMouseMove);
    window.addEventListener('mouseleave', hide);
    return () => {
      document.removeEventListener('mousemove', onDocumentMouseMove);
      window.removeEventListener('mouseleave', hide);
    };
  }, [tooltipInfo.show, hide]);

  const CustomRechartsTooltipComponent = useCallback(
    (props: any) => (
      <RechartsTooltipContent
        {...props}
        cardIdRef={cardIdRef}
        setTooltipInfo={setTooltipInfo}
        mousePositionRef={mousePositionRef}
        tooltipElementRef={tooltipElementRef}
      />
    ),
    []
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
                  borderTop: '1px solid var(--border)',
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
        if (label < 0) {
          tooltipContent = null;
        } else {
          tooltipContent = (
            <EpochLabel epoch={Number(label)}>
              <strong>{Number(value).toLocaleString()}</strong> jobs
            </EpochLabel>
          );
        }
        break;
      }
      case ChartTypeEnum.REVENUE_PER_EPOCH: {
        if (label < 0) {
          tooltipContent = null;
        } else {
          tooltipContent = (
            <EpochLabel epoch={Number(label)}>
              USDC <strong>{Number(value).toLocaleString()}</strong>
            </EpochLabel>
          );
        }
        break;
      }
      case ChartTypeEnum.SERVICE_REVENUE_PER_EPOCH: {
        if (label < 0) {
          tooltipContent = null;
        } else {
          tooltipContent = (
            <EpochLabel epoch={Number(label)}>
              USDC <strong>{Number(value).toLocaleString()}</strong>
            </EpochLabel>
          );
        }
        break;
      }
      case ChartTypeEnum.SESSIONS_PER_EPOCH: {
        if (label < 0) {
          tooltipContent = null;
        } else {
          tooltipContent = (
            <EpochLabel epoch={Number(label)}>
              <strong>{Number(value).toLocaleString()}</strong> sessions
            </EpochLabel>
          );
        }
        break;
      }
      default: {
        tooltipContent = <div>Value: {Number(value).toLocaleString()}</div>;
      }
    }

    if (tooltipContent === null || tooltipContent === undefined) {
      return null;
    }

    return ReactDOM.createPortal(
      <div
        ref={tooltipElementRef}
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
    plotRef,
    CustomRechartsTooltipComponent,
    renderTooltipPortal,
  };
};
