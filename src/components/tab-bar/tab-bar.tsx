import Button from '@/components/button/button';
import Card, { CardVariant } from '@/components/card/card';
import classNames from 'classnames';
import styles from './tab-bar.module.css';

type Tab = {
  href?: string;
  key: string;
  label: React.ReactNode;
  onClick?: () => void;
};

type TabBarProps = {
  activeKey: string;
  ariaLabel?: string;
  cardVariant?: CardVariant;
  className?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
  tabs: Tab[];
};

const TabBar = ({
  activeKey,
  ariaLabel,
  cardVariant = 'glass-shaded',
  className,
  disabled,
  size = 'md',
  tabs,
}: TabBarProps) => (
  <Card
    ariaLabel={ariaLabel}
    className={classNames(styles.root, { [styles.rootSm]: size === 'sm' }, className)}
    radius={size === 'sm' ? 'sm' : 'lg'}
    role="group"
    shadow={cardVariant === 'glass-shaded' ? 'black' : undefined}
    variant={cardVariant}
  >
    {tabs.map((tab) => {
      const active = tab.key === activeKey;
      return (
        <Button
          aria-current={tab.href && active ? 'page' : undefined}
          aria-pressed={tab.href ? undefined : active}
          color={active ? 'accent2' : 'primary'}
          disabled={disabled}
          href={tab.href}
          key={tab.key}
          onClick={tab.onClick}
          size={size}
          variant={active ? 'filled' : 'transparent'}
        >
          {tab.label}
        </Button>
      );
    })}
  </Card>
);

export default TabBar;
