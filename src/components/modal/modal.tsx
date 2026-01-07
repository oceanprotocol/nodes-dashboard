import CloseIcon from '@mui/icons-material/Close';
import { Breakpoint, Dialog, styled } from '@mui/material';
import { ReactNode } from 'react';
import styles from './modal.module.css';

const StyledDialog = styled(Dialog)({
  '& .MuiModal-backdrop': {
    backdropFilter: 'var(--backdrop-filter-overlay)',
  },

  '& .MuiDialog-paper': {
    background: 'var(--background-modal)',
    borderRadius: 24,
    boxShadow: 'var(--shadow-dialog), var(--inner-shadow-glass)',
    color: 'var(--text-primary)',
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
    padding: 24,
  },
});

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
    {children}
  </StyledDialog>
);

export default Modal;
