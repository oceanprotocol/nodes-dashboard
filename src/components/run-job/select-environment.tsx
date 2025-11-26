import Button from '@/components/button/button';
import Card from '@/components/card/card';
import EnvironmentCard from '@/components/environment-card/environment-card';
import GpuLabel from '@/components/gpu-label/gpu-label';
import Input from '@/components/input/input';
import Select from '@/components/input/select';
import { useRunJobContext } from '@/context/run-job-context';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import { Collapse } from '@mui/material';
import { useFormik } from 'formik';
import { useEffect, useMemo, useState } from 'react';
import styles from './select-environment.module.css';

type FilterFormValues = {
  gpus: string[];
  maxJobDuration: number | '';
  minCpuCores: number | '';
  minRam: number | '';
  minDiskSpace: number | '';
  // pricingToken: string;
  sortBy: string;
};

const SelectEnvironment = () => {
  const [expanded, setExpanded] = useState(false);

  const { environments, fetchEnvironments, fetchGpus, gpus } = useRunJobContext();

  useEffect(() => {
    fetchGpus();
  }, [fetchGpus]);

  const gpuOptions = useMemo(() => gpus.map((gpu) => ({ value: gpu.gpu_name, label: gpu.gpu_name })), [gpus]);

  const formik = useFormik<FilterFormValues>({
    initialValues: {
      gpus: [],
      maxJobDuration: '',
      minCpuCores: '',
      minRam: '',
      minDiskSpace: '',
      // pricingToken: '',
      sortBy: '',
    },
    onSubmit: (values) => {
      console.log('Form submitted with values:', values);
      fetchEnvironments();
    },
  });

  const toggleFilters = () => {
    if (expanded) {
      formik.setValues({
        ...formik.values,
        maxJobDuration: '',
        minCpuCores: '',
        minRam: '',
        minDiskSpace: '',
        // pricingToken: '',
      });
    }
    setExpanded(!expanded);
  };

  return (
    <Card direction="column" padding="md" radius="lg" spacing="md" variant="glass-shaded">
      <h3>Environments</h3>
      <form onSubmit={formik.handleSubmit}>
        <Card direction="column" padding="sm" radius="md" spacing="sm" variant="glass-outline">
          <Select
            label="GPUs"
            multiple
            name="gpus"
            onChange={formik.handleChange}
            options={gpuOptions}
            renderOption={(option) => <GpuLabel gpu={option.label} />}
            renderSelectedValue={(option) => <GpuLabel gpu={option} />}
            value={formik.values.gpus}
          />
          <Collapse in={expanded}>
            <div className={styles.extraFilters}>
              <Input
                endAdornment="cores"
                label="CPU"
                name="minCpuCores"
                onChange={formik.handleChange}
                size="sm"
                startAdornment="from"
                type="number"
                value={formik.values.minCpuCores}
              />
              <Input
                endAdornment="GB"
                label="RAM"
                name="minRam"
                onChange={formik.handleChange}
                size="sm"
                startAdornment="from"
                type="number"
                value={formik.values.minRam}
              />
              <Input
                endAdornment="GB"
                label="Disk space"
                name="minDiskSpace"
                onChange={formik.handleChange}
                size="sm"
                startAdornment="from"
                type="number"
                value={formik.values.minDiskSpace}
              />
              <Input
                endAdornment="hours"
                label="Max job duration"
                name="maxJobDuration"
                onChange={formik.handleChange}
                size="sm"
                startAdornment="from"
                type="number"
                value={formik.values.maxJobDuration}
              />
              {/* <Select
                label="Pricing token"
                name="pricingToken"
                onChange={formik.handleChange}
                size="sm"
                value={formik.values.pricingToken}
              /> */}
            </div>
          </Collapse>
          <div className={styles.footer}>
            <Select
              className={styles.sortSelect}
              label="Sort"
              name="sortBy"
              onChange={formik.handleChange}
              size="sm"
              value={formik.values.sortBy}
            />
            <div className={styles.buttons}>
              <Button color="accent1" contentBefore={<FilterAltIcon />} onClick={toggleFilters} variant="outlined">
                {expanded ? 'Fewer filters' : 'More filters'}
              </Button>
              <Button color="accent1" type="submit">
                Find environments
              </Button>
            </div>
          </div>
        </Card>
      </form>
      <div className={styles.list}>
        {environments.map((env) => (
          <EnvironmentCard compact environment={env} key={env.id} showNodeName />
        ))}
      </div>
    </Card>
  );
};

export default SelectEnvironment;
