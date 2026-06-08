import { useOceanAccount } from '@/lib/use-ocean-account';
import { useAuthModal } from '@account-kit/react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getTutorialConfig } from './registry';
import { StepPlacement, TutorialStep } from './types';
import { useTutorialContext } from './tutorial-context';
import styles from './tutorial-overlay.module.css';

const POPOVER_WIDTH = 340;
const POPOVER_MARGIN = 16;
const ARROW_SIZE = 12;
const RING_PADDING = 6;

type Rect = { top: number; left: number; width: number; height: number };

const isElementEnabled = (el: Element | null): boolean => {
  if (!el) return false;
  if (el instanceof HTMLButtonElement) return !el.disabled;
  const btn = el.querySelector('button');
  if (btn) return !btn.disabled;
  return true;
};

const getHiddenInputValue = (el: Element | null): string => {
  if (!el) return '';
  const input = el.querySelector('input');
  if (!input) return '';
  return input.value ?? '';
};

const computePopoverPosition = (
  rect: Rect | null,
  placement: StepPlacement,
  popoverHeight: number,
  viewportWidth: number,
  viewportHeight: number
): { top: number; left: number; arrow: { top: number; left: number } | null } => {
  if (!rect || placement === 'center') {
    return { top: 0, left: 0, arrow: null };
  }

  let top = 0;
  let left = 0;
  let arrowTop = 0;
  let arrowLeft = 0;

  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  switch (placement) {
    case 'top':
      top = rect.top - popoverHeight - POPOVER_MARGIN;
      left = centerX - POPOVER_WIDTH / 2;
      arrowTop = rect.top - POPOVER_MARGIN - ARROW_SIZE / 2 + (popoverHeight - ARROW_SIZE) / 2 - (popoverHeight / 2 - ARROW_SIZE / 2);
      arrowTop = rect.top - ARROW_SIZE / 2 - POPOVER_MARGIN / 2;
      arrowLeft = centerX - ARROW_SIZE / 2;
      break;
    case 'bottom':
      top = rect.top + rect.height + POPOVER_MARGIN;
      left = centerX - POPOVER_WIDTH / 2;
      arrowTop = rect.top + rect.height + POPOVER_MARGIN / 2 - ARROW_SIZE / 2;
      arrowLeft = centerX - ARROW_SIZE / 2;
      break;
    case 'left':
      top = centerY - popoverHeight / 2;
      left = rect.left - POPOVER_WIDTH - POPOVER_MARGIN;
      arrowTop = centerY - ARROW_SIZE / 2;
      arrowLeft = rect.left - POPOVER_MARGIN / 2 - ARROW_SIZE / 2;
      break;
    case 'right':
      top = centerY - popoverHeight / 2;
      left = rect.left + rect.width + POPOVER_MARGIN;
      arrowTop = centerY - ARROW_SIZE / 2;
      arrowLeft = rect.left + rect.width + POPOVER_MARGIN / 2 - ARROW_SIZE / 2;
      break;
  }

  if (left < 8) left = 8;
  if (left + POPOVER_WIDTH > viewportWidth - 8) left = viewportWidth - POPOVER_WIDTH - 8;
  if (top < 8) top = 8;
  if (top + popoverHeight > viewportHeight - 8) top = viewportHeight - popoverHeight - 8;

  return { top, left, arrow: { top: arrowTop, left: arrowLeft } };
};

const useTargetRect = (selector: string | undefined): { rect: Rect | null; element: Element | null } => {
  const [rect, setRect] = useState<Rect | null>(null);
  const [element, setElement] = useState<Element | null>(null);

  useLayoutEffect(() => {
    if (!selector) {
      setRect(null);
      setElement(null);
      return;
    }

    let frame = 0;
    let cancelled = false;

    const measure = () => {
      const el = document.querySelector(selector);
      if (!el) {
        setElement(null);
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      let top = r.top;
      let left = r.left;
      let right = r.right;
      let bottom = r.bottom;

      // If the target opens a portaled menu (e.g. MUI Select), extend the
      // cutout to cover the open menu too — it lives outside the target's box.
      const expander = el.querySelector('[aria-expanded="true"][aria-controls]');
      const controls = expander?.getAttribute('aria-controls');
      const menu = controls ? document.getElementById(controls) : null;
      const menuRect = (menu?.closest('.MuiPaper-root') ?? menu)?.getBoundingClientRect();
      if (menuRect && menuRect.width > 0 && menuRect.height > 0) {
        top = Math.min(top, menuRect.top);
        left = Math.min(left, menuRect.left);
        right = Math.max(right, menuRect.right);
        bottom = Math.max(bottom, menuRect.bottom);
      }

      setElement(el);
      setRect({ top, left, width: right - left, height: bottom - top });
    };

    const tick = () => {
      if (cancelled) return;
      measure();
      frame = window.requestAnimationFrame(tick);
    };

    tick();

    const handleResize = () => measure();
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
    };
  }, [selector]);

  return { rect, element };
};

type Props = {
  currentPage: string;
};

const TutorialOverlay = ({ currentPage }: Props) => {
  const { active, advance, stop, goToStep } = useTutorialContext();
  const { account } = useOceanAccount();
  const { isOpen: isAuthModalOpen } = useAuthModal();
  const isConnected = account.isConnected;
  const [mounted, setMounted] = useState(false);
  const [popoverHeight, setPopoverHeight] = useState(180);
  const popoverRef = useRef<HTMLDivElement>(null);
  const lastValueRef = useRef<string>('');

  useEffect(() => {
    setMounted(true);
  }, []);

  const config = active ? getTutorialConfig(active.id) : null;
  const step: TutorialStep | null = useMemo(() => {
    if (!config || !active) return null;
    return config.steps[active.stepIndex] ?? null;
  }, [config, active]);

  useEffect(() => {
    if (!config || !active || !step) return;
    if (step.page === currentPage) return;
    const nextMatching = config.steps.findIndex(
      (s, i) => i > active.stepIndex && s.page === currentPage
    );
    if (nextMatching >= 0) {
      goToStep(nextMatching);
    }
  }, [config, active, step, currentPage, goToStep]);

  const stepOnThisPage = !!step && step.page === currentPage;
  const { rect, element } = useTargetRect(stepOnThisPage ? step?.target : undefined);

  useLayoutEffect(() => {
    if (popoverRef.current) {
      setPopoverHeight(popoverRef.current.offsetHeight);
    }
  }, [step?.id, rect]);

  useEffect(() => {
    if (!stepOnThisPage || !element || !step) return;
    if (step.advance.type === 'next') return;

    if (step.advance.type === 'click' || step.advance.type === 'navigate') {
      const handler = () => {
        setTimeout(() => advance(), 0);
      };
      element.addEventListener('click', handler, true);
      return () => element.removeEventListener('click', handler, true);
    }

    if (step.advance.type === 'change') {
      lastValueRef.current = getHiddenInputValue(element);
      const pollMs = step.advance.pollMs ?? 250;
      const interval = window.setInterval(() => {
        const value = getHiddenInputValue(element);
        if (value && value !== lastValueRef.current) {
          lastValueRef.current = value;
          advance();
        }
      }, pollMs);
      return () => window.clearInterval(interval);
    }

    if (step.advance.type === 'value') {
      // Advance as soon as the target holds a non-empty value — including when
      // it was already set on entry (e.g. GPUs pre-selected from a prior run).
      const pollMs = step.advance.pollMs ?? 250;
      const check = () => {
        if (getHiddenInputValue(element)) advance();
      };
      check();
      const interval = window.setInterval(check, pollMs);
      return () => window.clearInterval(interval);
    }
  }, [stepOnThisPage, element, step, advance]);

  useEffect(() => {
    if (!stepOnThisPage || !step) return;
    if (step.advance.type !== 'auth') return;
    // Fires immediately if already connected (auto-skips the step on replay),
    // or once the user finishes connecting via the auth modal.
    if (isConnected) advance();
  }, [stepOnThisPage, step, isConnected, advance]);

  useEffect(() => {
    if (!stepOnThisPage || !element) return;
    const node = element as HTMLElement;
    if (typeof node.scrollIntoView === 'function') {
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [stepOnThisPage, element]);

  if (!mounted || !active || !config || !step) return null;

  if (!stepOnThisPage) {
    return null;
  }

  // Yield to the auth modal so the user can connect — otherwise the overlay
  // shades (z-index 2147483600) bury the account-kit modal and block clicks.
  if (isAuthModalOpen) {
    return null;
  }

  // Auth step + already connected → the effect will advance; don't flash it.
  if (step.advance.type === 'auth' && isConnected) {
    return null;
  }

  const isCentered = !step.target || step.placement === 'center';
  const placement = step.placement ?? 'bottom';
  const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const viewportH = typeof window !== 'undefined' ? window.innerHeight : 768;
  const targetEnabled = step.requireEnabled ? isElementEnabled(element) : true;
  const waitingForEnabled = step.requireEnabled && !targetEnabled;

  const popoverPos = computePopoverPosition(
    isCentered ? null : rect,
    placement,
    popoverHeight,
    viewportW,
    viewportH
  );

  const showNextBtn = step.advance.type === 'next';
  const stepNumber = active.stepIndex + 1;
  const totalSteps = config.steps.length;

  const ringRect = !isCentered && rect
    ? {
        top: rect.top - RING_PADDING,
        left: rect.left - RING_PADDING,
        width: rect.width + RING_PADDING * 2,
        height: rect.height + RING_PADDING * 2,
      }
    : null;

  const shades = !isCentered && ringRect
    ? [
        { top: 0, left: 0, width: viewportW, height: Math.max(0, ringRect.top) },
        {
          top: ringRect.top + ringRect.height,
          left: 0,
          width: viewportW,
          height: Math.max(0, viewportH - (ringRect.top + ringRect.height)),
        },
        { top: ringRect.top, left: 0, width: Math.max(0, ringRect.left), height: ringRect.height },
        {
          top: ringRect.top,
          left: ringRect.left + ringRect.width,
          width: Math.max(0, viewportW - (ringRect.left + ringRect.width)),
          height: ringRect.height,
        },
      ]
    : null;

  const advanceLabel = (() => {
    if (waitingForEnabled) return 'Waiting…';
    if (step.advance.type === 'click') return 'Waiting for click…';
    if (step.advance.type === 'change') return 'Waiting for selection…';
    if (step.advance.type === 'value') return 'Waiting for selection…';
    if (step.advance.type === 'navigate') return 'Waiting for click…';
    if (step.advance.type === 'auth') return 'Waiting for connection…';
    return null;
  })();

  const overlay = (
    <div className={styles.root} aria-live="polite">
      {isCentered ? (
        <div className={styles.shade} style={{ top: 0, left: 0, right: 0, bottom: 0 }} />
      ) : (
        shades?.map((s, i) => (
          <div
            key={i}
            className={styles.shade}
            style={{ top: s.top, left: s.left, width: s.width, height: s.height }}
          />
        ))
      )}

      {ringRect ? (
        <div
          className={styles.ring}
          style={{ top: ringRect.top, left: ringRect.left, width: ringRect.width, height: ringRect.height }}
        />
      ) : null}

      <div
        ref={popoverRef}
        className={isCentered ? `${styles.popover} ${styles.popoverCenter}` : styles.popover}
        style={isCentered ? undefined : { top: popoverPos.top, left: popoverPos.left }}
        role="dialog"
        aria-labelledby="tutorial-title"
        aria-describedby="tutorial-description"
      >
        <h3 id="tutorial-title" className={styles.title}>
          {step.title}
        </h3>
        <p id="tutorial-description" className={styles.description}>
          {step.description}
        </p>
        <div className={styles.footer}>
          <span className={styles.progress}>
            Step {stepNumber} of {totalSteps}
          </span>
          <div className={styles.actions}>
            {active.stepIndex > 0 ? (
              <button
                type="button"
                className={`${styles.btn} ${styles.btnGhost}`}
                onClick={() => goToStep(active.stepIndex - 1)}
              >
                Back
              </button>
            ) : null}
            <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={stop}>
              Skip tour
            </button>
            {showNextBtn ? (
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={advance}>
                {stepNumber === totalSteps ? 'Finish' : 'Next'}
              </button>
            ) : (
              <span className={styles.waitingHint}>{advanceLabel}</span>
            )}
          </div>
        </div>
      </div>

      {!isCentered && popoverPos.arrow ? (
        <div className={styles.arrow} style={{ top: popoverPos.arrow.top, left: popoverPos.arrow.left }} />
      ) : null}
    </div>
  );

  return createPortal(overlay, document.body);
};

export default TutorialOverlay;
