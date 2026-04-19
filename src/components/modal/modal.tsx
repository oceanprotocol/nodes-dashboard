import CloseIcon from '@mui/icons-material/Close';
import { Breakpoint, Dialog, styled } from '@mui/material';
import { ReactNode } from 'react';
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

const Modal = ({ children, fullWidth, hideCloseButton, isOpen, onClose, title, width }: ModalProps) => (
  <StyledDialog fullWidth={fullWidth || !!width} maxWidth={width} onClose={onClose} open={isOpen}>
    <div className={styles.header}>
      {title && <h3 className={styles.title}>{title}</h3>}
      {hideCloseButton ? null : (
        <button className={styles.closeButton} onClick={onClose} type="button" aria-label="Close modal">
          <CloseIcon className={styles.icon} />
        </button>
      )}
    </div>
    <div className={styles.body}>{children}</div>
  </StyledDialog>
);

export default Modal;
