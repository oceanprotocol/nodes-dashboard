'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

type UseVideoScrollOptions = {
  numSteps: number;
  debug?: boolean;
};

type ScrollTriggerInstance = {
  start: number;
  end: number;
  progress: number;
  refresh: () => void;
  update: () => void;
  scroll: (y: number) => void;
  kill: () => void;
};

const SEEK_FALLBACK_DELAY_MS = 300;
const MIN_VIDEO_READY_STATE = 1;
const PROGRESS_CLAMP_MAX = 0.9999;
const TIME_EPSILON = 0.001;
const SNAP_DURATION = 0.35;
const SCRUB_DURATION = 0.5;
const ANTICIPATE_PIN = 0.5;
const MOBILE_BREAKPOINT = 768;

const isMobileViewport = () => {
  if (typeof window === 'undefined') {
    return false;
  }
  return window.innerWidth <= MOBILE_BREAKPOINT;
};

const clampTime = (time: number, duration: number): number => {
  return Math.max(0, Math.min(time, duration - TIME_EPSILON));
};

const calculateEndDistance = (numSteps: number) => window.innerHeight * (numSteps - 1);

const calculateSnapValue = (progress: number, numSteps: number) => {
  return Math.round(progress * (numSteps - 1)) / (numSteps - 1);
};

export function useVideoScroll({ numSteps, debug }: UseVideoScrollOptions) {
  const [activeIndex, setActiveIndex] = useState(0);
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scrollTriggerRef = useRef<ScrollTriggerInstance | null>(null);
  const videoDurationRef = useRef(0);
  const isSeekingRef = useRef(false);
  const pendingSeekTimeRef = useRef<number | null>(null);
  const hasInitializedVideoRef = useRef(false);
  const seekFallbackTimerRef = useRef<number | null>(null);
  const isMobileRef = useRef(false);

  const refreshScrollTrigger = useCallback(() => {
    const scrollTrigger = scrollTriggerRef.current;
    if (scrollTrigger) {
      scrollTrigger.refresh();
      scrollTrigger.update();
    }
  }, []);

  const seekToTime = useCallback((targetTime: number) => {
    const video = videoRef.current;
    const duration = videoDurationRef.current;
    if (!video || duration === 0 || Number.isNaN(targetTime)) {
      return;
    }
    const clampedTime = clampTime(targetTime, duration);
    if (!isSeekingRef.current) {
      isSeekingRef.current = true;
      try {
        video.currentTime = clampedTime;
        if (seekFallbackTimerRef.current) {
          window.clearTimeout(seekFallbackTimerRef.current);
          seekFallbackTimerRef.current = null;
        }
        seekFallbackTimerRef.current = window.setTimeout(() => {
          if (isSeekingRef.current) {
            isSeekingRef.current = false;
          }
        }, SEEK_FALLBACK_DELAY_MS);
      } catch {
        isSeekingRef.current = false;
      }
    } else {
      pendingSeekTimeRef.current = clampedTime;
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    isMobileRef.current = isMobileViewport();

    if (isMobileRef.current) {
      return;
    }

    let scrollTriggerInstance: ScrollTriggerInstance | null = null;
    (async () => {
      const { ScrollTrigger } = await import('gsap/ScrollTrigger');
      gsap.registerPlugin(ScrollTrigger);

      const sectionElement = sectionRef.current;
      if (!sectionElement) {
        return;
      }

      scrollTriggerInstance = ScrollTrigger.create({
        trigger: sectionElement,
        start: 'top top',
        end: () => '+=' + calculateEndDistance(numSteps),
        pin: true,
        pinSpacing: true,
        pinReparent: true,
        anticipatePin: ANTICIPATE_PIN,
        scrub: SCRUB_DURATION,
        invalidateOnRefresh: true,
        snap: {
          snapTo: (progress: number) => calculateSnapValue(progress, numSteps),
          duration: SNAP_DURATION,
          ease: 'power2.inOut',
        },
        markers: debug,
        onUpdate: (scrollTrigger: ScrollTriggerInstance) => {
          const videoDuration = videoDurationRef.current;
          if (videoDuration > 0) {
            const clampedProgress = Math.min(PROGRESS_CLAMP_MAX, Math.max(0, scrollTrigger.progress));
            seekToTime(clampedProgress * videoDuration);
          }
          const calculatedStepIndex = Math.round(scrollTrigger.progress * (numSteps - 1));
          setActiveIndex(calculatedStepIndex);
        },
      }) as ScrollTriggerInstance;
      scrollTriggerRef.current = scrollTriggerInstance;
      requestAnimationFrame(() => {
        scrollTriggerInstance?.refresh();
      });
    })();

    const handleResize = () => {
      const isMobile = isMobileViewport();
      if (isMobile !== isMobileRef.current) {
        isMobileRef.current = isMobile;
        if (scrollTriggerInstance) {
          scrollTriggerInstance.kill();
          scrollTriggerRef.current = null;
        }
        window.location.reload();
      } else {
        scrollTriggerRef.current?.refresh();
      }
    };
    const handleWindowLoad = () => {
      scrollTriggerRef.current?.refresh();
      scrollTriggerRef.current?.update();
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('load', handleWindowLoad);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('load', handleWindowLoad);
      scrollTriggerInstance?.kill();
    };
  }, [numSteps, seekToTime, debug]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const video = videoRef.current;
    if (!video) {
      return;
    }

    const isMobile = isMobileViewport();
    isMobileRef.current = isMobile;

    if (isMobile) {
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      const handleCanPlayMobile = () => {
        video.play().catch(() => {});
      };
      video.addEventListener('canplay', handleCanPlayMobile);
      if (video.readyState >= MIN_VIDEO_READY_STATE) {
        video.play().catch(() => {});
      }
      return () => {
        video.removeEventListener('canplay', handleCanPlayMobile);
      };
    }

    const handleSeekComplete = () => {
      if (pendingSeekTimeRef.current !== null) {
        const nextPendingTime = pendingSeekTimeRef.current;
        pendingSeekTimeRef.current = null;
        video.currentTime = nextPendingTime;
      } else {
        isSeekingRef.current = false;
      }
    };

    const initializeVideoDecoder = () => {
      if (hasInitializedVideoRef.current) {
        return;
      }

      hasInitializedVideoRef.current = true;
      videoDurationRef.current = video.duration || 0;
      video.muted = true;
      video
        .play()
        .then(() => {
          video.pause();
          video.currentTime = 0;
          refreshScrollTrigger();
        })
        .catch(() => {
          video.currentTime = 0;
          refreshScrollTrigger();
        });
    };

    const handleVideoReady = () => initializeVideoDecoder();

    video.addEventListener('loadedmetadata', handleVideoReady);
    video.addEventListener('loadeddata', handleVideoReady);
    video.addEventListener('canplay', handleVideoReady);
    video.addEventListener('seeked', handleSeekComplete);

    if (video.readyState >= MIN_VIDEO_READY_STATE && video.duration > 0) {
      initializeVideoDecoder();
    }

    return () => {
      if (seekFallbackTimerRef.current) {
        window.clearTimeout(seekFallbackTimerRef.current);
        seekFallbackTimerRef.current = null;
      }
      video.removeEventListener('loadedmetadata', handleVideoReady);
      video.removeEventListener('loadeddata', handleVideoReady);
      video.removeEventListener('canplay', handleVideoReady);
      video.removeEventListener('seeked', handleSeekComplete);
    };
  }, [refreshScrollTrigger]);

  const calculateScrollYForStep = useCallback(
    (stepIndex: number) => {
      const scrollTrigger = scrollTriggerRef.current;
      if (!scrollTrigger) {
        return window.scrollY;
      }

      const startPosition = scrollTrigger.start;
      const endPosition = scrollTrigger.end;
      if (typeof startPosition !== 'number' || typeof endPosition !== 'number') {
        return window.scrollY;
      }

      const stepProgress = stepIndex / (numSteps - 1);
      return startPosition + (endPosition - startPosition) * stepProgress;
    },
    [numSteps],
  );

  return {
    sectionRef,
    videoRef,
    activeIndex,
  };
}
