import Button from '@/components/button/button';
import Card from '@/components/card/card';
import classNames from 'classnames';
import { useRouter } from 'next/router';
import styles from './tab-bar.module.css';

type Tab = {
  href?: string;
  key: string;
  label: React.ReactNode;
  onClick?: () => void;
};

type TabBarProps = {
  activeKey: string;
  className?: string;
  size?: 'sm' | 'md';
  tabs: Tab[];
};

const TabBar = ({ activeKey, className, size = 'md', tabs }: TabBarProps) => {
  const router = useRouter();

  const handleTabClick = (tab: Tab) => {
    if (tab.onClick) {
      tab.onClick();
    }
    if (tab.href) {
      router.push(tab.href);
    }
  };

  return (
    <Card
      className={classNames(styles.root, { [styles.rootSm]: size === 'sm' }, className)}
      radius="lg"
      shadow="black"
      variant="glass-shaded"
    >
      {tabs.map((tab) => {
        const isActive = tab.key === activeKey;
        return (
          <Button
            className={classNames(styles.tab, { [styles.tabSm]: size === 'sm' })}
            color={isActive ? 'accent2' : 'primary'}
            key={tab.key}
            onClick={() => handleTabClick(tab)}
            size={size}
            variant={isActive ? 'filled' : 'transparent'}
          >
            {tab.label}
          </Button>
        );
      })}
    </Card>
  );
};

export default TabBar;
