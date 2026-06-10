import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getTutorialConfig } from './registry';
import { TutorialId } from './types';

const ACTIVE_KEY = 'ocean-tutorial-active';
const COMPLETED_KEY = 'ocean-tutorial-completed';

type ActiveTutorial = {
  id: TutorialId;
  stepIndex: number;
};

type TutorialContextValue = {
  active: ActiveTutorial | null;
  start: (id: TutorialId, startIndex?: number) => void;
  stop: () => void;
  advance: () => void;
  goToStep: (index: number) => void;
  isCompleted: (id: TutorialId) => boolean;
};

const TutorialContext = createContext<TutorialContextValue | null>(null);

const readActive = (): ActiveTutorial | null => {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(ACTIVE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const writeActive = (value: ActiveTutorial | null) => {
  if (typeof window === 'undefined') return;
  if (value === null) {
    localStorage.removeItem(ACTIVE_KEY);
  } else {
    localStorage.setItem(ACTIVE_KEY, JSON.stringify(value));
  }
};

const readCompleted = (): string[] => {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(COMPLETED_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

const markCompleted = (id: TutorialId) => {
  if (typeof window === 'undefined') return;
  const list = readCompleted();
  if (!list.includes(id)) {
    list.push(id);
    localStorage.setItem(COMPLETED_KEY, JSON.stringify(list));
  }
};

export const TutorialProvider = ({ children }: { children: React.ReactNode }) => {
  const [active, setActive] = useState<ActiveTutorial | null>(null);

  useEffect(() => {
    setActive(readActive());
  }, []);

  const start = useCallback((id: TutorialId, startIndex = 0) => {
    const next = { id, stepIndex: startIndex };
    writeActive(next);
    setActive(next);
  }, []);

  const stop = useCallback(() => {
    writeActive(null);
    setActive(null);
  }, []);

  const advance = useCallback(() => {
    setActive((prev) => {
      if (!prev) return prev;
      const config = getTutorialConfig(prev.id);
      const nextIndex = prev.stepIndex + 1;
      if (nextIndex >= config.steps.length) {
        markCompleted(prev.id);
        writeActive(null);
        return null;
      }
      const next = { id: prev.id, stepIndex: nextIndex };
      writeActive(next);
      return next;
    });
  }, []);

  const goToStep = useCallback((index: number) => {
    setActive((prev) => {
      if (!prev) return prev;
      const config = getTutorialConfig(prev.id);
      if (index < 0 || index >= config.steps.length) return prev;
      const next = { id: prev.id, stepIndex: index };
      writeActive(next);
      return next;
    });
  }, []);

  const isCompleted = useCallback((id: TutorialId) => {
    return readCompleted().includes(id);
  }, []);

  const value = useMemo(
    () => ({ active, start, stop, advance, goToStep, isCompleted }),
    [active, start, stop, advance, goToStep, isCompleted]
  );

  return <TutorialContext.Provider value={value}>{children}</TutorialContext.Provider>;
};

export const useTutorialContext = () => {
  const ctx = useContext(TutorialContext);
  if (!ctx) throw new Error('useTutorialContext must be used inside TutorialProvider');
  return ctx;
};
