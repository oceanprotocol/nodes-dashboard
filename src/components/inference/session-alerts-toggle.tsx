import Button from '@/components/button/button';
import { enableNotifications, isOptedIn, isSupported, notifyState, NotifyState, setOptedIn } from '@/lib/notifications';
import { useOceanAccount } from '@/lib/use-ocean-account';
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined';
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined';
import { useEffect, useState } from 'react';
import styles from './session-alerts-toggle.module.css';

/**
 * Opt-in for OS notifications about this session's expiry.
 *
 * Placed beside the countdown so the ask lands at the moment it is easiest to say yes to — money has
 * just been committed to a clock. Never prompts on its own: the permission is spent once and a
 * refusal cannot be revisited, and Chrome demotes the prompt on origins that ask carelessly.
 */
const SessionAlertsToggle: React.FC = () => {
  const { account } = useOceanAccount();
  const address = account.address;

  // Permission and localStorage are client-only, so start neutral and resolve after mount — keeps
  // the server render and the first client render identical.
  const [state, setState] = useState<NotifyState>('unsupported');
  const [optedIn, setLocalOptedIn] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setState(notifyState());
    setLocalOptedIn(isOptedIn(address));
  }, [address]);

  if (!isSupported() || state === 'unsupported') {
    return null;
  }

  if (state === 'denied') {
    return (
      <div className={styles.note}>
        Notifications are blocked for this site, but the in-app warning will still appear while the dashboard is open.
      </div>
    );
  }

  if (state === 'granted' && optedIn) {
    return (
      <div className={styles.row}>
        <NotificationsActiveOutlinedIcon className={styles.icon} fontSize="small" />
        <span className={styles.note}>You&apos;ll be notified 10 minutes before this session ends.</span>
        <Button
          onClick={() => {
            setOptedIn(address, false);
            setLocalOptedIn(false);
          }}
          size="sm"
          variant="transparent"
        >
          Turn off
        </Button>
      </div>
    );
  }

  return (
    <div className={styles.row}>
      <Button
        contentBefore={<NotificationsNoneOutlinedIcon />}
        loading={busy}
        onClick={async () => {
          setBusy(true);
          // Called straight out of the click so the gesture is still live — Safari shows no prompt
          // otherwise.
          const next = await enableNotifications();
          setState(next);
          if (next === 'granted') {
            setOptedIn(address, true);
            setLocalOptedIn(true);
          }
          setBusy(false);
        }}
        size="sm"
        variant="outlined"
      >
        Notify me before this ends
      </Button>
      <span className={styles.note}>Alerts you even when this tab isn&rsquo;t the one you&rsquo;re looking at.</span>
    </div>
  );
};

export default SessionAlertsToggle;
