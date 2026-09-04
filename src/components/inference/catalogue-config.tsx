import Button from '@/components/button/button';
import { selectBundles, selectServices } from '@/services/service-templates';
import { AppTemplate } from '@/types/templates';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import cx from 'classnames';
import { ReactNode } from 'react';
import styles from './catalogue.module.css';

/**
 * Everything that differs between the two catalogues, in one place.
 *
 * The pages are otherwise the same page (see CataloguePage) and the toolbar is the same toolbar (see
 * CatalogueBrowser), so the only thing worth writing twice is the copy — and this is where the wire
 * vocabulary (`service` / `bundle`) is translated into the product's ("Service" / "Template").
 */
export type CatalogueCopy = {
  /** Toolbar heading and lead. */
  heading: string;
  lead: string;
  /** Noun used in the counts, summary line and empty hints. Product vocabulary. */
  noun: string;
  nounPlural: string;
  searchPlaceholder: string;
  /** Route the filter state is mirrored into, so a refresh or a shared link restores it. */
  pathname: string;
  /** Shown instead of the toolbar when this catalogue has no entries at all — the two pages differ. */
  empty: ReactNode;
};

export type CatalogueConfig = CatalogueCopy & {
  /** First step's label in the stepper — the catalogue knows its kind before anything is picked. */
  kindLabel: 'Service' | 'Template';
  /** Narrows the node's catalogue to this page's entries. */
  select: (catalogue: AppTemplate[]) => AppTemplate[];
};

export const SERVICES_CATALOGUE: CatalogueConfig = {
  kindLabel: 'Service',
  // Bundles have their own page — one listed here too would appear twice.
  select: selectServices,
  pathname: '/inference/services',
  heading: 'Pick a service',
  lead: 'Ready-made containerized apps. Pick one, review what’s inside, choose an environment, pay and launch. Models are yours to add from the app once it’s running.',
  noun: 'service',
  nounPlural: 'services',
  searchPlaceholder: 'Search services',
  empty: <div className={cx(styles.stateBox, 'textSecondary')}>No services available.</div>,
};

export const BUNDLES_CATALOGUE: CatalogueConfig = {
  kindLabel: 'Template',
  select: selectBundles,
  pathname: '/inference/templates',
  heading: 'Pick a template',
  lead: 'An app with its models already included. Pick what you want to get done and launch. The models download in the background while the app comes up.',
  noun: 'template',
  nounPlural: 'templates',
  searchPlaceholder: 'Search templates',
  // Nothing published: point at the catalogue that does have something rather than an empty grid.
  empty: (
    <div className={styles.emptyState}>
      <Inventory2OutlinedIcon className={styles.emptyIcon} />
      <div className={styles.emptyTitle}>No templates on this node yet</div>
      <div className={styles.emptyHint}>
        Templates are published by the node you&apos;re connected to. This one advertises none right now, but you can
        still start any service and add models from its own UI.
      </div>
      <Button
        className={styles.emptyReset}
        color="accent1"
        contentAfter={<ArrowForwardIcon />}
        href="/inference/services"
        size="sm"
      >
        Browse services
      </Button>
    </div>
  ),
};
