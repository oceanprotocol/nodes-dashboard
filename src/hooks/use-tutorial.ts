import { useCallback, useMemo } from 'react';
import { useTutorialContext } from '@/components/tutorial/tutorial-context';
import { getTutorialConfig, TutorialId, TutorialPage } from '@/components/tutorial/run-job-tutorial';

export const useTutorial = (id: TutorialId, currentPage: TutorialPage) => {
  const { active, start, stop, isCompleted } = useTutorialContext();

  const isActive = !!active && active.id === id;

  const startTutorial = useCallback(() => {
    const config = getTutorialConfig(id);
    const firstOnPage = config.steps.findIndex((step) => step.page === currentPage);
    start(id, firstOnPage >= 0 ? firstOnPage : 0);
  }, [id, currentPage, start]);

  const stopTutorial = useCallback(() => {
    stop();
  }, [stop]);

  const hasCompletedTutorial = useCallback(() => isCompleted(id), [id, isCompleted]);

  return useMemo(
    () => ({
      isActive,
      startTutorial,
      stopTutorial,
      hasCompletedTutorial,
    }),
    [isActive, startTutorial, stopTutorial, hasCompletedTutorial]
  );
};
