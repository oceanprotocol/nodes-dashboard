import Button from '@/components/button/button';
import Card from '@/components/card/card';
import EnvironmentCard from '@/components/environment-card/environment-card';
import Input from '@/components/input/input';
import Select from '@/components/input/select';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import { Collapse } from '@mui/material';
import { useState } from 'react';
import styles from './select-environment.module.css';

const SelectEnvironment = () => {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card direction="column" padding="md" radius="lg" spacing="md" variant="glass-shaded">
      <h3>Environments</h3>
      <form>
        <Card direction="column" padding="sm" radius="md" spacing="sm" variant="glass-outline">
          <Select label="GPUs" multiple />
          <Collapse in={expanded}>
            <div className={styles.extraFilters}>
              <Input endAdornment="seconds" label="Max job duration from" size="sm" />
              <Input endAdornment="cores" label="Minimum CPU cores" size="sm" />
              <Input endAdornment="GB" label="Minimum RAM" size="sm" />
              <Input endAdornment="GB" label="Minimum disk space" size="sm" />
              <Select label="Pricing token" size="sm" />
            </div>
          </Collapse>
          <div className={styles.footer}>
            <Select className={styles.sortSelect} label="Sort" size="sm" />
            <div className={styles.buttons}>
              <Button
                color="accent1"
                contentBefore={<FilterAltIcon />}
                onClick={() => setExpanded(!expanded)}
                variant="outlined"
              >
                {expanded ? 'Fewer filters' : 'More filters'}
              </Button>
              <Button color="accent1">Find environments</Button>
            </div>
          </div>
        </Card>
      </form>
      <div className={styles.list}>
        <EnvironmentCard compact showNodeName />
        <EnvironmentCard compact showNodeName />
      </div>
    </Card>
  );
};

export default SelectEnvironment;
