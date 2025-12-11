import { Dialog } from '@account-kit/react';
import CloseIcon from '@mui/icons-material/Close';
import cx from 'classnames';
import { ReactNode } from 'react';
import styles from './modal.module.css';

type Size = 'sm' | 'md' | 'lg';
type Variant = 'glass' | 'glass-shaded' | 'solid';

type ModalProps = {
  children: ReactNode;
  className?: string;
  fullWidth?: boolean;
  isOpen: boolean;
  onClose: () => void;
  padding?: Size;
  radius?: Size;
  title?: string;
  variant?: Variant;
};

const Modal = ({
  children,
  className,
  fullWidth,
  isOpen,
  onClose,
  padding = 'md',
  radius = 'md',
  title,
  variant = 'solid',
}: ModalProps) => (
  <Dialog fullWidth={fullWidth} isOpen={isOpen} onClose={onClose}>
    <div
      className={cx(
        styles.root,
        styles[`padding-${padding}`],
        styles[`radius-${radius}`],
        styles[`variant-${variant}`],
        className
      )}
    >
      <div className={styles.header}>
        {title && <h3 className={styles.title}>{title}</h3>}
        <button className={styles.closeButton} onClick={onClose} type="button" aria-label="Close modal">
          <CloseIcon />
        </button>
      </div>
      <div className={styles.content}>{children}</div>
    </div>
  </Dialog>
);

export default Modal;
