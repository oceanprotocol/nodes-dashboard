import { useEffect, useState } from 'react';
import styles from './rotating-text.module.css';

type RotatingTextProps = {
  className?: string;
  intervalMs?: number;
  words: string[];
};

export default function RotatingText({ className, intervalMs = 2500, words }: RotatingTextProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (words.length < 2) {
      return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    const timer = setInterval(() => setIndex((prev) => (prev + 1) % words.length), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs, words.length]);

  return (
    <span className={className}>
      <span className={styles.word} key={index}>
        {words[index]}
      </span>
    </span>
  );
}
