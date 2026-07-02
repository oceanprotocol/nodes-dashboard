import Button from '@/components/button/button';
import Input from '@/components/input/input';
import { useRunJobContext } from '@/context/run-job-context';
import { type AlgorithmLanguage, detectLanguageFromFilename, looksLikeDataset } from '@/lib/compute-inputs';
import { stashOptimisticJob } from '@/lib/optimistic-job';
import classNames from 'classnames';
import { useRouter } from 'next/router';
import posthog from 'posthog-js';
import { useRef, useState } from 'react';
import { toast } from 'react-toastify';
import styles from './authoring-panel.module.css';

type AuthoringTab = 'algorithm' | 'dataset' | 'dockerfile' | 'env';

const TABS: { key: AuthoringTab; label: string }[] = [
  { key: 'algorithm', label: 'Algorithm' },
  { key: 'dataset', label: 'Dataset' },
  { key: 'dockerfile', label: 'Dockerfile' },
  { key: 'env', label: 'Env vars' },
];

const LANGUAGES: { value: AlgorithmLanguage; label: string }[] = [
  { value: 'py', label: 'Python' },
  { value: 'js', label: 'JavaScript' },
];

type AuthoringPanelProps = {
  authToken: string;
  consumerAddress: string;
};

const AuthoringPanel = ({ authToken, consumerAddress }: AuthoringPanelProps) => {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dockerfileInputRef = useRef<HTMLInputElement>(null);
  const {
    algorithmCode,
    setAlgorithmCode,
    algorithmLanguage,
    setAlgorithmLanguage,
    dataset,
    setDataset,
    dockerfile,
    setDockerfile,
    envVars,
    setEnvVars,
    freeCompute,
    selectedEnv,
    selectedResources,
    submitJob,
  } = useRunJobContext();

  const [activeTab, setActiveTab] = useState<AuthoringTab>('algorithm');
  const [submitting, setSubmitting] = useState(false);

  const datasetWarning = dataset.trim() && !looksLikeDataset(dataset) ? 'Expected a DID, URL, IPFS hash, or Arweave id.' : '';

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setAlgorithmCode(text);
    const detected = detectLanguageFromFilename(file.name);
    if (detected) {
      setAlgorithmLanguage(detected);
    }
    // Allow re-uploading the same filename.
    event.target.value = '';
  };

  const handleDockerfileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setDockerfile(await file.text());
    event.target.value = '';
  };

  const updateEnvVar = (index: number, patch: Partial<{ key: string; value: string }>) => {
    setEnvVars(envVars.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
  };

  const addEnvVar = () => setEnvVars([...envVars, { key: '', value: '' }]);
  const removeEnvVar = (index: number) => setEnvVars(envVars.filter((_, i) => i !== index));

  const handleSubmit = async () => {
    if (!algorithmCode.trim()) {
      toast.error('Add your algorithm code before submitting.');
      setActiveTab('algorithm');
      return;
    }
    setSubmitting(true);
    try {
      const job = await submitJob({ authToken, consumerAddress });
      if (selectedEnv && selectedResources) {
        stashOptimisticJob({
          jobId: job.jobId,
          consumer: consumerAddress,
          environmentId: selectedEnv.id,
          isFree: freeCompute,
          dateCreated: Math.floor(Date.now() / 1000),
          maxJobDuration: selectedResources.maxJobDurationSeconds,
        });
      }
      posthog.capture('dashboard_job_submitted', {
        environmentId: selectedEnv?.id,
        freeCompute,
        hasDataset: !!dataset.trim(),
        hasCustomDockerfile: !!dockerfile.trim(),
        language: algorithmLanguage,
      });
      toast.success('Job submitted');
      router.push('/profile/consumer');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start the job. Please try again.';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.root}>
      <div className={styles.tabs} role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.key}
            className={classNames(styles.tab, { [styles.tabActive]: activeTab === tab.key })}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'algorithm' && (
        <div className={styles.section}>
          <div className={styles.row}>
            <div className={styles.languageGroup}>
              <span className={styles.fieldLabel}>Language</span>
              <div className={styles.radioGroup}>
                {LANGUAGES.map((language) => (
                  <label key={language.value} className={styles.radio}>
                    <input
                      type="radio"
                      name="algorithm-language"
                      checked={algorithmLanguage === language.value}
                      onChange={() => setAlgorithmLanguage(language.value)}
                    />
                    {language.label}
                  </label>
                ))}
              </div>
            </div>
            <Button color="accent1" onClick={() => fileInputRef.current?.click()} size="sm" type="button" variant="outlined">
              Upload .py / .js
            </Button>
            <input ref={fileInputRef} type="file" accept=".py,.js" className={styles.hiddenInput} onChange={handleUpload} />
          </div>
          <textarea
            className={styles.codeEditor}
            placeholder="Paste your algorithm here, or upload a .py / .js file."
            spellCheck={false}
            value={algorithmCode}
            onChange={(event) => setAlgorithmCode(event.target.value)}
          />
        </div>
      )}

      {activeTab === 'dataset' && (
        <div className={styles.section}>
          <Input
            type="text"
            label="Dataset (optional)"
            placeholder="did:op:... or https://... or Qm..."
            hint={datasetWarning || 'DID, URL, IPFS hash, or Arweave id. Leave empty if your algorithm fetches its own data.'}
            errorText={datasetWarning || undefined}
            value={dataset}
            onChange={(event) => setDataset(event.target.value)}
          />
        </div>
      )}

      {activeTab === 'dockerfile' && (
        <div className={styles.section}>
          <div className={styles.row}>
            <span className={styles.fieldLabel}>Dockerfile (optional)</span>
            <Button
              color="accent1"
              onClick={() => dockerfileInputRef.current?.click()}
              size="sm"
              type="button"
              variant="outlined"
            >
              Upload Dockerfile
            </Button>
            <input ref={dockerfileInputRef} type="file" className={styles.hiddenInput} onChange={handleDockerfileUpload} />
          </div>
          <textarea
            className={styles.codeEditor}
            placeholder={`Leave empty to use the default ${algorithmLanguage === 'py' ? 'Python' : 'JavaScript'} image.\nDo not set your own ENTRYPOINT/CMD — the node runs your algorithm via $ALGO.`}
            spellCheck={false}
            value={dockerfile}
            onChange={(event) => setDockerfile(event.target.value)}
          />
        </div>
      )}

      {activeTab === 'env' && (
        <div className={styles.section}>
          <span className={styles.fieldLabel}>Environment variables</span>
          {envVars.length === 0 && <p className={styles.muted}>No environment variables.</p>}
          {envVars.map((entry, index) => (
            <div key={index} className={styles.envRow}>
              <Input
                type="text"
                placeholder="KEY"
                value={entry.key}
                onChange={(event) => updateEnvVar(index, { key: event.target.value })}
              />
              <Input
                type="text"
                placeholder="value"
                value={entry.value}
                onChange={(event) => updateEnvVar(index, { value: event.target.value })}
              />
              <Button color="accent1" onClick={() => removeEnvVar(index)} size="sm" type="button" variant="transparent">
                Remove
              </Button>
            </div>
          ))}
          <div>
            <Button color="accent1" onClick={addEnvVar} size="sm" type="button" variant="outlined">
              + Add variable
            </Button>
          </div>
        </div>
      )}

      <div className={styles.footer}>
        <Button autoLoading color="accent1" disabled={submitting} onClick={handleSubmit} size="lg" type="button">
          Submit job
        </Button>
      </div>
    </div>
  );
};

export default AuthoringPanel;
