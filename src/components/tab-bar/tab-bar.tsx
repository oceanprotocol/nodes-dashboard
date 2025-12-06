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
  tabs: Tab[];
};

const TabBar = ({ activeKey, className, tabs }: TabBarProps) => {
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
    <Card className={classNames(styles.root, className)} radius="lg" variant="glass-shaded">
      {tabs.map((tab) => (
        <div
          className={classNames(styles.tab, { [styles.tabActive]: tab.key === activeKey })}
          key={tab.key}
          onClick={() => handleTabClick(tab)}
        >
          {tab.label}
        </div>
      ))}
    </Card>
  );
};

export default TabBar;
