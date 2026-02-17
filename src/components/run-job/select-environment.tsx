import Button from '@/components/button/button';
import Card from '@/components/card/card';
import EnvironmentCard from '@/components/environment-card/environment-card';
import GpuLabel from '@/components/gpu-label/gpu-label';
import Input from '@/components/input/input';
import Select from '@/components/input/select';
import { RawFilters, useRunJobEnvsContext } from '@/context/run-job-envs-context';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import { Collapse } from '@mui/material';
import { useFormik } from 'formik';
import { useEffect, useMemo, useState } from 'react';
import styles from './select-environment.module.css';

const sortOptions = [
  { label: 'No sorting', value: '' },
  { label: 'Price ascending', value: JSON.stringify({ price: 'asc' }) },
  { label: 'Price descending', value: JSON.stringify({ price: 'desc' }) },
];

type FilterFormValues = {
  gpuName: string[];
  fromMaxJobDuration: number | '';
  minimumCPU: number | '';
  minimumRAM: number | '';
  minimumStorage: number | '';
  feeToken: string;
  sortBy: string;
};

const SelectEnvironment = () => {
  const { fetchGpus, filters, gpus, loading, loadMoreEnvs, nodeEnvs, paginationResponse, setFilters, setSort, sort } =
    useRunJobEnvsContext();

  const [expanded, setExpanded] = useState(!!filters);

  useEffect(() => {
    fetchGpus();
  }, [fetchGpus]);

  const gpuOptions = useMemo(() => gpus.map((gpu) => ({ value: gpu.gpuName, label: gpu.gpuName })), [gpus]);

  const formik = useFormik<FilterFormValues>({
    initialValues: {
      gpuName: filters.gpuName ?? [],
      fromMaxJobDuration: filters.fromMaxJobDuration ?? '',
      minimumCPU: filters.minimumCPU ?? '',
      minimumRAM: filters.minimumRAM ?? '',
      minimumStorage: filters.minimumStorage ?? '',
      feeToken: '',
      sortBy: sort ?? '',
    },
    onSubmit: async (values) => {
      const filters: RawFilters = { gpuName: values.gpuName };
      if (values.fromMaxJobDuration !== '') {
        filters.fromMaxJobDuration = Number(values.fromMaxJobDuration);
      }
      if (values.minimumCPU !== '') {
        filters.minimumCPU = Number(values.minimumCPU);
      }
      if (values.minimumRAM !== '') {
        filters.minimumRAM = Number(values.minimumRAM);
      }
      if (values.minimumStorage !== '') {
        filters.minimumStorage = Number(values.minimumStorage);
      }
      if (values.gpuName.length > 0) {
        filters.gpuName = values.gpuName;
      }
      setFilters(filters);
      setSort(values.sortBy);
    },
  });

  const toggleFilters = () => {
    if (expanded) {
      formik.setValues({
        ...formik.values,
        fromMaxJobDuration: '',
        minimumCPU: '',
        minimumRAM: '',
        minimumStorage: '',
        feeToken: '',
      });
    }
    setExpanded(!expanded);
  };

  return (
    <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
      <h3>Environments</h3>
      <form onSubmit={formik.handleSubmit}>
        <Card direction="column" padding="sm" radius="md" shadow="black" spacing="sm" variant="glass-outline">
          <Select
            label="GPUs"
            multiple
            name="gpuName"
            onChange={formik.handleChange}
            options={gpuOptions}
            renderOption={(option) => <GpuLabel gpu={option.label} />}
            renderSelectedValue={(option) => <GpuLabel gpu={option} />}
            value={formik.values.gpuName}
          />
          <Collapse in={expanded}>
            <div className={styles.extraFilters}>
              <Input
                endAdornment="cores"
                label="CPU"
                name="minimumCPU"
                onChange={formik.handleChange}
                size="sm"
                startAdornment="from"
                type="number"
                value={formik.values.minimumCPU}
              />
              <Input
                endAdornment="GB"
                label="RAM"
                name="minimumRAM"
                onChange={formik.handleChange}
                size="sm"
                startAdornment="from"
                type="number"
                value={formik.values.minimumRAM}
              />
              <Input
                endAdornment="GB"
                label="Disk space"
                name="minimumStorage"
                onChange={formik.handleChange}
                size="sm"
                startAdornment="from"
                type="number"
                value={formik.values.minimumStorage}
              />
              <Input
                endAdornment="hours"
                label="Max job duration"
                name="fromMaxJobDuration"
                onChange={formik.handleChange}
                size="sm"
                startAdornment="from"
                type="number"
                value={formik.values.fromMaxJobDuration}
              />
              {/* <Select
                label="Pricing token"
                name="feeToken"
                onChange={formik.handleChange}
                size="sm"
                value={formik.values.feeToken}
              /> */}
            </div>
          </Collapse>
          <div className={styles.footer}>
            <Select
              className={styles.sortSelect}
              label="Sort"
              name="sortBy"
              onChange={formik.handleChange}
              options={sortOptions}
              size="sm"
              value={formik.values.sortBy}
            />
            <div className={styles.buttons}>
              <Button color="primary" contentBefore={<FilterAltIcon />} onClick={toggleFilters} variant="transparent">
                {expanded ? 'Fewer filters' : 'More filters'}
              </Button>
              <Button color="accent2" loading={loading} type="submit" variant="filled">
                Find environments
              </Button>
            </div>
          </div>
        </Card>
      </form>
      <div className={styles.list}>
        {nodeEnvs.map((node) =>
          node.computeEnvironments.environments.map((env) => (
            <EnvironmentCard
              compact
              environment={env}
              key={env.id}
              nodeInfo={{
                friendlyName: node.friendlyName,
                id: node.id,
              }}
              showNodeName
            />
          ))
        )}
        {paginationResponse && paginationResponse.currentPage < paginationResponse.totalPages && (
          <Button className="alignSelfCenter" color="accent2" loading={loading} onClick={loadMoreEnvs}>
            Load more
          </Button>
        )}
      </div>
    </Card>
  );
};

export default SelectEnvironment;
