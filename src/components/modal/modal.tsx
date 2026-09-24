import CloseIcon from '@mui/icons-material/Close';
import { Breakpoint, Dialog, styled } from '@mui/material';
import { ReactNode, useEffect, useRef } from 'react';
import styles from './modal.module.css';

const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiModal-backdrop': {
    backdropFilter: 'var(--backdrop-filter-overlay)',
    backgroundColor: 'var(--background-modal-overlay)',
  },

  '& .MuiDialog-paper': {
    background: 'var(--background-modal)',
    borderRadius: 24,
    boxShadow: 'var(--inner-shadow-glass), var(--drop-shadow-black)',
    color: 'var(--text-primary)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    padding: 0,

    [theme.breakpoints.down('sm')]: {
      borderRadius: 16,
      margin: 16,
      width: 'calc(100% - 32px)',
    },
  },
}));

type ModalProps = {
  children: ReactNode;
  fullWidth?: boolean;
  hideCloseButton?: boolean;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  width?: Breakpoint;
};

const Modal = ({ children, fullWidth, hideCloseButton, isOpen, onClose, title, width }: ModalProps) => {
  // Callers usually clear the data a modal renders (`{item && …}`) in the same update that closes it,
  // while the Dialog is still fading out, so the content vanished and the dialog shrank to its header
  // mid-transition. While closing, render what was last shown open; the Dialog unmounts it on exit.
  // Saved after commit, not during render, so a render React throws away can't become what's shown.
  const lastOpen = useRef({ children, title });
  useEffect(() => {
    if (isOpen) {
      lastOpen.current = { children, title };
    }
  }, [isOpen, children, title]);
  const shown = isOpen ? { children, title } : lastOpen.current;

  return (
    <StyledDialog fullWidth={fullWidth || !!width} maxWidth={width} onClose={onClose} open={isOpen}>
      <div className={styles.header}>
        {shown.title && <h3 className={styles.title}>{shown.title}</h3>}
        {hideCloseButton ? null : (
          <button className={styles.closeButton} onClick={onClose} type="button" aria-label="Close modal">
            <CloseIcon className={styles.icon} />
          </button>
        )}
      </div>
      <div className={styles.body}>{shown.children}</div>
    </StyledDialog>
  );
};

export default Modal;
