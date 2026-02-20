import Button from '@/components/button/button';
import Modal from '@/components/modal/modal';
import { useState } from 'react';
import styles from './download-logs-modal.module.css';

type Preset = '1h' | '24h' | '7d' | '30d' | 'custom';

const MAX_LOGS_OPTIONS = [100, 500, 1_000];

type DownloadLogsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onDownload: (startTime: string, endTime: string, maxLogs: number) => Promise<void>;
  loading: boolean;
};

function getPresetRange(preset: Exclude<Preset, 'custom'>): { startTime: string; endTime: string } {
  const now = new Date();
  const msMap = { '1h': 3600000, '24h': 86400000, '7d': 604800000, '30d': 2592000000 };
  return {
    startTime: new Date(now.getTime() - msMap[preset]).toISOString(),
    endTime: now.toISOString(),
  };
}

function toDatetimeLocal(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const DownloadLogsModal = ({ isOpen, onClose, onDownload, loading }: DownloadLogsModalProps) => {
  const [preset, setPreset] = useState<Preset>('24h');
  const [customStart, setCustomStart] = useState(() => toDatetimeLocal(new Date(Date.now() - 86400000)));
  const [customEnd, setCustomEnd] = useState(() => toDatetimeLocal(new Date()));
  const [maxLogs, setMaxLogs] = useState(1_000);

  function handleDownload() {
    let startTime: string;
    let endTime: string;
    if (preset === 'custom') {
      startTime = new Date(customStart).toISOString();
      endTime = new Date(customEnd).toISOString();
    } else {
      const range = getPresetRange(preset);
      startTime = range.startTime;
      endTime = range.endTime;
    }
    return onDownload(startTime, endTime, maxLogs);
  }

  const presets: { label: string; value: Preset }[] = [
    { label: '1h', value: '1h' },
    { label: '24h', value: '24h' },
    { label: '7d', value: '7d' },
    { label: '30d', value: '30d' },
    { label: 'Custom', value: 'custom' },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Download node logs" width="sm">
      <div className={styles.modalContent}>
        <div className={styles.presets}>
          {presets.map((p) => (
            <button
              key={p.value}
              className={`${styles.preset} ${preset === p.value ? styles.active : ''}`}
              onClick={() => setPreset(p.value)}
              type="button"
            >
              {p.label}
            </button>
          ))}
        </div>

        {preset === 'custom' && (
          <div className={styles.dateFields}>
            <div className={styles.dateField}>
              <label>Start</label>
              <input type="datetime-local" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
            </div>
            <div className={styles.dateField}>
              <label>End</label>
              <input type="datetime-local" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
            </div>
          </div>
        )}

        <div className={styles.maxLogs}>
          <label>Max log lines</label>
          <div className={styles.presets}>
            {MAX_LOGS_OPTIONS.map((opt) => (
              <button
                key={opt}
                className={`${styles.preset} ${maxLogs === opt ? styles.active : ''}`}
                onClick={() => setMaxLogs(opt)}
                type="button"
              >
                {opt.toLocaleString()}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.buttons}>
          <Button color="accent1" onClick={onClose} type="button" variant="outlined">
            Cancel
          </Button>
          <Button autoLoading color="accent1" loading={loading} onClick={handleDownload} type="button" variant="filled">
            Download
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default DownloadLogsModal;
