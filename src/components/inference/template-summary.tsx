import Card from '@/components/card/card';
import BundleIncludes from '@/components/inference/bundle-includes';
import { decorate } from '@/components/inference/template-card';
import { accentVars, templateImageRef } from '@/components/inference/template-visual';
import { useTheme } from '@/lib/use-theme';
import { AppTemplate, includesSummary } from '@/types/templates';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { Collapse } from '@mui/material';
import cx from 'classnames';
import { CSSProperties, useState } from 'react';
import styles from './template-summary.module.css';

type DetailRow = {
  label: string;
  value: React.ReactNode;
};

type TemplateSummaryProps = {
  template: AppTemplate;
  /**
   * Values committed for the template's userConfigurableEnvVars — sensitive ones render masked.
   * Omit it where they aren't KNOWN rather than passing `{}`: the values live in the container's
   * userData and are never in the URL (they can be secrets) nor in the node's job record, so a
   * manage-page view has no way to read back what a service was started with. Omitted → the section
   * says the values aren't visible; `{}` would claim none were set.
   */
  envValues?: Record<string, string>;
  /**
   * The image ref the container is ACTUALLY running (`job.image[:tag]`), where a job record is
   * available. It outranks the template's own ref: an Edit relaunch swaps the image in place
   * (serviceRestart, same serviceId), so the template the link names can be one the service no longer
   * runs. A mismatch is called out rather than silently papered over.
   */
  runningImageRef?: string;
};

/**
 * Read-only summary of the picked app template — the templates-flow counterpart of
 * InferenceModelList's model row. Same shape: identity + headline chips on one row, the full spec
 * (image ref, exposed port, resource asks, configured env vars) behind a toggle. Used by the payment
 * step and the navigation bar's selection panel, so both read the same way as the model flows.
 * Everything is derived from the template itself (see decorate/templateHardware) — the node publishes
 * no category, logo or colour.
 */
const TemplateSummary: React.FC<TemplateSummaryProps> = ({ template, envValues, runningImageRef }) => {
  const [open, setOpen] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const { resolvedTheme } = useTheme();
  const item = decorate(template);

  // Hardware asks as icon+label pairs — same set the catalogue card shows, minus the fallback note
  // (by this step the environment card below already states the real booked resources).
  const hardware = item.meta;

  const envSpecs = template.userConfigurableEnvVars ?? [];
  // Only the vars the user actually filled in. Sensitive values (tokens, keys) are never rendered —
  // they'd otherwise sit in plain sight on the payment step.
  const envRows: DetailRow[] = envSpecs
    .filter((spec) => (envValues?.[spec.key] ?? '') !== '')
    .map((spec) => ({
      label: spec.key,
      value: spec.sensitive ? '••••••••' : (envValues?.[spec.key] ?? ''),
    }));

  // What the bundle pre-downloaded, straight from the node's `includes[]`. Gated on the list being
  // non-empty rather than on isBundle: a node that publishes includes without the `kind` field still
  // has something worth showing, and a bare service simply has no list.
  const includes = template.includes ?? [];
  const includesLine = includesSummary(template);

  const templateRef = templateImageRef(template);
  // The running image wins where it's known; flag a divergence so a link naming a since-swapped
  // template doesn't read as the truth (see the runningImageRef prop docs).
  const imageMismatch = !!runningImageRef && runningImageRef !== templateRef;
  // No Container section at all: image ref, port and template id are all machine-facing. The name and
  // logo above identify the app, the reachable URL is what a running service is used through, and the
  // image ref only ever mattered as the thing an Edit relaunch could swap — which the mismatch note
  // below states outright, refs included.

  return (
    <Card
      className={styles.card}
      direction="column"
      innerShadow="black"
      radius="sm"
      style={accentVars(item.accent, resolvedTheme) as CSSProperties}
      variant="glass"
    >
      <button aria-expanded={open} className={styles.row} onClick={() => setOpen((prev) => !prev)} type="button">
        <span className={styles.tile}>
          {item.mono ? (
            <span className={styles.tileMono}>{item.mono}</span>
          ) : (
            <item.CategoryIcon className={styles.tileIcon} />
          )}
          {item.logo && !logoFailed && (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="" className={styles.tileLogo} onError={() => setLogoFailed(true)} src={item.logo} />
          )}
        </span>
        <span className={styles.identity}>
          <span className={styles.name}>{item.name}</span>
          <span className={styles.sub}>
            {item.categoryLabel} · {item.vendor}
          </span>
        </span>
        <span className={styles.chips}>
          {includesLine && <span className={cx('chip', 'chipAccent1', styles.chip)}>{includesLine}</span>}
          <span className={cx('chip', 'chipGlass', styles.chip)}>{item.gpu ? 'GPU' : 'CPU'}</span>
          <span className={cx('chip', 'chipAccent2', styles.chip)}>{item.interaction}</span>
        </span>
        <ExpandMoreIcon className={cx(styles.chevron, { [styles.chevronOpen]: open })} fontSize="small" />
      </button>
      <Collapse in={open} unmountOnExit>
        <div className={styles.panel}>
          {imageMismatch && (
            // Everything else in the panel describes the NAMED template, so say so once rather than
            // annotating each section. Both refs are named here — it's the only place they appear.
            <p className={cx(styles.desc, 'textAccent1')}>
              The container runs {runningImageRef}, not the {templateRef} this template publishes. Everything below
              describes the template, not what is running.
            </p>
          )}
          {template.description && <p className={styles.desc}>{template.description}</p>}

          {includes.length > 0 && (
            // First group in the panel: on a running service this is what the user most often wants to
            // check ("which weights are in there?"), and unlike the rows below it doesn't depend on the
            // image actually matching the template.
            <div className={styles.group}>
              <span className={styles.eyebrow}>Included</span>
              <BundleIncludes template={template} />
              {includesLine && <span className={styles.includesNote}>{includesLine}</span>}
            </div>
          )}

          <div className={styles.group}>
            <span className={styles.eyebrow}>Template asks for</span>
            <div className={styles.hardwareRow}>
              {hardware.map(({ key, Icon, label }) => (
                <span className={styles.hardware} key={key}>
                  <Icon className={styles.hardwareIcon} />
                  {label}
                </span>
              ))}
              {item.metaFallback && <span className={styles.hardwareFallback}>{item.metaFallback}</span>}
            </div>
          </div>

          {envSpecs.length > 0 && (
            <div className={styles.group}>
              <span className={styles.eyebrow}>Environment variables</span>
              {envRows.length > 0 ? (
                <dl className={styles.grid}>
                  {envRows.map((row) => (
                    <div className={styles.item} key={row.label}>
                      <dt className={styles.label}>{row.label}</dt>
                      <dd className={styles.value}>{row.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : envValues ? (
                <span className="textSecondary">None configured, so the image defaults apply.</span>
              ) : (
                // No values passed = we can't read them back (see the envValues prop docs). List the
                // keys the template accepts so the section still says something true.
                <span className="textSecondary">
                  Set inside the container and not readable from here: {envSpecs.map((spec) => spec.key).join(', ')}
                </span>
              )}
            </div>
          )}
        </div>
      </Collapse>
    </Card>
  );
};

export default TemplateSummary;
