import Button from '@/components/button/button';
import Card from '@/components/card/card';
import Container from '@/components/container/container';
import ConfigureGeneral from '@/components/run-node/configure-general';
import ConfigureIndexer from '@/components/run-node/configure-indexer';
import ConfigureResources from '@/components/run-node/configure-resources';
import SectionTitle from '@/components/section-title/section-title';
import { getRunNodeSteps, RunNodeStep } from '@/components/stepper/get-steps';
import Stepper from '@/components/stepper/stepper';
import { useRunNodeContext } from '@/context/run-node-context';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { CircularProgress, Collapse } from '@mui/material';
import classNames from 'classnames';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import styles from './configure-page.module.css';

const ConfigurePage: React.FC = () => {
  const router = useRouter();

  const { configErrors, loadingPushConfig, loadingFetchConfig, nodeConfig, peerId, pushConfig } = useRunNodeContext();

  const [configGeneralOpen, setConfigGeneralOpen] = useState(true);
  const [configResourcesOpen, setConfigResourcesOpen] = useState(true);
  const [configIndexerOpen, setConfigIndexerOpen] = useState(true);

  const [editedConfig, setEditedConfig] = useState(nodeConfig ?? {});

  useEffect(() => {
    if (!peerId) {
      router.replace('/run-node/setup');
    }
  }, [peerId, router]);

  return (
    <Container className="pageRoot">
      <SectionTitle
        moreReadable
        title="Run a node"
        subTitle={
          loadingFetchConfig ? (
            <div className="flexRow alignItemsCenter gapMd">
              <CircularProgress size={24} />
              <span>Loading node config...</span>
            </div>
          ) : (
            'Configure resources, settings and other preferences for your node'
          )
        }
        contentBetween={<Stepper<RunNodeStep> currentStep="configure" steps={getRunNodeSteps()} />}
        mobileWarning
      />
      {peerId ? (
        <div className="pageContentWrapper">
          {/* General config */}
          <Card direction="column" padding="md" radius="lg" shadow="black" variant="glass-shaded">
            <h3
              className={styles.collapsibleSectionTitle}
              onClick={() => setConfigGeneralOpen(!configGeneralOpen)}
              tabIndex={0}
            >
              General
              <ExpandMoreIcon className={classNames(styles.icon, { [styles.iconOpen]: configGeneralOpen })} />
            </h3>
            <Collapse in={!loadingFetchConfig && configGeneralOpen}>
              <ConfigureGeneral config={editedConfig} setConfig={setEditedConfig} />
            </Collapse>
          </Card>

          {/* Resources config */}
          <Card direction="column" padding="md" radius="lg" shadow="black" variant="glass-shaded">
            <h3
              className={styles.collapsibleSectionTitle}
              onClick={() => setConfigResourcesOpen(!configResourcesOpen)}
              tabIndex={0}
            >
              Resources
              <ExpandMoreIcon className={classNames(styles.icon, { [styles.iconOpen]: configResourcesOpen })} />
            </h3>
            <Collapse in={!loadingFetchConfig && configResourcesOpen}>
              <ConfigureResources config={editedConfig} setConfig={setEditedConfig} />
            </Collapse>
          </Card>

          {/* Indexer config */}
          <Card direction="column" padding="md" radius="lg" shadow="black" variant="glass-shaded">
            <h3
              className={styles.collapsibleSectionTitle}
              onClick={() => setConfigIndexerOpen(!configIndexerOpen)}
              tabIndex={0}
            >
              Indexer
              <ExpandMoreIcon className={classNames(styles.icon, { [styles.iconOpen]: configIndexerOpen })} />
            </h3>
            <Collapse in={!loadingFetchConfig && configIndexerOpen}>
              <ConfigureIndexer config={editedConfig} setConfig={setEditedConfig} />
            </Collapse>
          </Card>

          {/* Errors */}
          <Collapse in={!loadingFetchConfig && configErrors.length > 0}>
            <Card direction="column" padding="md" radius="lg" spacing="sm" variant="error-outline">
              <h3 className="textError">Config errors</h3>
              <ul className={styles.errorsList}>
                {configErrors.map((error, index) => (
                  <li key={`${index}-${error}`}>{error}</li>
                ))}
              </ul>
            </Card>
          </Collapse>

          {/* Actions */}
          <div className="actionsGroupLgEnd">
            <Button color="accent1" disabled={loadingPushConfig} href="/run-node/setup" size="lg" variant="outlined">
              Back
            </Button>
            <Button
              color="accent1"
              loading={loadingPushConfig}
              onClick={() => pushConfig(editedConfig)}
              size="lg"
              variant="filled"
            >
              Push config to node
            </Button>
          </div>
        </div>
      ) : null}
    </Container>
  );
};

export default ConfigurePage;
