import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import CloseIcon from '@mui/icons-material/Close';
import { IconButton, Tooltip } from '@mui/material';
import { TutorialId, TutorialPage } from '@/components/tutorial/types';
import { useTutorial } from '@/hooks/use-tutorial';
import styles from './tutorial-button.module.css';

type TutorialButtonProps = {
  tutorialId: TutorialId;
  currentPage: TutorialPage;
  variant?: 'icon' | 'floating';
};

const TutorialButton = ({ tutorialId, currentPage, variant = 'icon' }: TutorialButtonProps) => {
  const { hasCompletedTutorial, isActive, startTutorial, stopTutorial } = useTutorial(tutorialId, currentPage);

  if (variant === 'floating') {
    return (
      <div className={styles.floatingContainer}>
        {isActive ? (
          <Tooltip title="Close tutorial">
            <IconButton onClick={stopTutorial} className={styles.floatingButton} color="error">
              <CloseIcon />
            </IconButton>
          </Tooltip>
        ) : (
          <Tooltip title={!hasCompletedTutorial() ? 'Take a guided tour' : 'Replay tutorial'}>
            <IconButton
              onClick={startTutorial}
              className={`${styles.floatingButton} ${!hasCompletedTutorial() ? styles.hasNotification : ''}`}
              color="primary"
            >
              <HelpOutlineIcon />
            </IconButton>
          </Tooltip>
        )}
      </div>
    );
  }

  return (
    <Tooltip title={!hasCompletedTutorial() ? 'Take a guided tour' : 'Replay tutorial'}>
      <IconButton onClick={startTutorial} size="small" className={styles.inlineButton}>
        <HelpOutlineIcon fontSize="small" />
      </IconButton>
    </Tooltip>
  );
};

export default TutorialButton;
