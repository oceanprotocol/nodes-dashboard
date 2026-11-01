import classNames from 'classnames';
import React, { useEffect, useRef, useState } from 'react';
import styles from './auto-height.module.css';

type AutoHeightProps = {
  children: React.ReactNode;
  className?: string;
};

/** Animates its own height to follow its content, so swapped or growing content doesn't jump the layout. */
const AutoHeight: React.FC<AutoHeightProps> = ({ children, className }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>();

  useEffect(() => {
    const element = contentRef.current;
    if (!element) {
      return;
    }
    const observer = new ResizeObserver(() => setHeight(element.offsetHeight));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={classNames(styles.root, className)} style={{ height }}>
      <div ref={contentRef}>{children}</div>
    </div>
  );
};

export default AutoHeight;
