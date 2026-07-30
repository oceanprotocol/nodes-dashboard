import { useModalStatus } from '@privy-io/react-auth';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './privy-modal-wallets.module.css';
import WalletList, { type WalletListProps } from './wallet-list';

// ponytail: anchored to Privy's private modal DOM. Verified against @privy-io/react-auth
// 3.22.2, laid out as #privy-dialog > [backdrop, wrapper > [id^=headlessui-dialog-panel] >
// #privy-modal-content]. We attach to the panel: #privy-modal-content is a fixed-height
// `overflow: hidden auto` box that would clip us, and <body> is click-blocked by the backdrop.
// If Privy renames these the section stops rendering and EOAHandler's modal is the fallback.
// Re-check on every @privy-io/react-auth upgrade.
const CONTENT_ID = 'privy-modal-content';
const PANEL_SELECTOR = '[id^="headlessui-dialog-panel"]';

const findAnchor = (): HTMLElement | null => {
  const content = document.getElementById(CONTENT_ID);
  // Only the landing screen offers a choice of method; the email field disappears after it.
  if (!content?.querySelector('input[type="email"]')) return null;
  return content.closest<HTMLElement>(PANEL_SELECTOR);
};

/** Renders the injected-wallet list inside Privy's own login modal. */
const PrivyModalWallets = (props: WalletListProps) => {
  const { isOpen } = useModalStatus();
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [onLandingScreen, setOnLandingScreen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    // A container we own, never Privy's node directly: React removes portal children on
    // unmount, and if Privy already swapped that subtree removeChild throws NotFoundError.
    const container = document.createElement('div');
    let attachedTo: HTMLElement | null = null;

    const observer = new MutationObserver(() => sync());
    let scopedToDialog = false;

    const sync = () => {
      const anchor = findAnchor();
      setOnLandingScreen(!!anchor);
      if (anchor && attachedTo !== anchor) {
        anchor.appendChild(container);
        attachedTo = anchor;
      }
      // Narrow to the dialog root once it exists: on document.body every toast or chart
      // frame re-runs this. It isn't mounted on the first pass.
      const dialog = document.getElementById('privy-dialog');
      if (dialog && !scopedToDialog) {
        scopedToDialog = true;
        observer.disconnect();
        observer.observe(dialog, { childList: true, subtree: true });
      }
    };

    // The panel mounts a tick after isOpen and swaps as Privy changes screens.
    sync();
    setHost(container);
    if (!scopedToDialog) {
      observer.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      observer.disconnect();
      setHost(null);
      setOnLandingScreen(false);
      container.remove();
    };
  }, [isOpen]);

  // Hidden rather than unmounted across screen changes, so the portal only unmounts with
  // the container we control.
  if (!host) return null;

  // Privy exposes no close method, but it is a HeadlessUI Dialog and closes on Escape.
  const closePrivyModal = () => document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape' }));

  return createPortal(
    <div className={styles.panel} hidden={!onLandingScreen}>
      <div className={styles.divider}>or connect a wallet</div>
      <WalletList {...props} onConnected={closePrivyModal} />
    </div>,
    host
  );
};

export default PrivyModalWallets;
