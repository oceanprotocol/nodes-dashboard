import Button from '@/components/button/button';
import Checkbox from '@/components/checkbox/checkbox';
import Input from '@/components/input/input';
import { useRunJobContext } from '@/context/run-job-context';
import { type NodeUri } from '@/contexts/P2PContext';
import { useNodeStorage } from '@/contexts/node-storage-context';
import { detectLanguageFromFilename, looksLikeDataset } from '@/lib/compute-inputs';
import { stashOptimisticJob } from '@/lib/optimistic-job';
import classNames from 'classnames';
import { useRouter } from 'next/router';
import posthog from 'posthog-js';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import styles from './authoring-panel.module.css';

type AuthoringTab = 'algorithm' | 'dataset' | 'dockerfile' | 'env' | 'storage';

const TABS: { key: AuthoringTab; label: string }[] = [
  { key: 'algorithm', label: 'Algorithm' },
  { key: 'dataset', label: 'Dataset' },
  { key: 'dockerfile', label: 'Dockerfile' },
  { key: 'env', label: 'Env vars' },
  { key: 'storage', label: 'Storage' },
];

type AuthoringPanelProps = {
  authToken: string;
  consumerAddress: string;
};

const AuthoringPanel = ({ authToken, consumerAddress }: AuthoringPanelProps) => {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dockerfileInputRef = useRef<HTMLInputElement>(null);
  const buildFilesInputRef = useRef<HTMLInputElement>(null);
  const {
    algorithmCode,
    setAlgorithmCode,
    algorithmLanguage,
    setAlgorithmLanguage,
    additionalDockerFiles,
    setAdditionalDockerFiles,
    dataset,
    setDataset,
    dockerfile,
    setDockerfile,
    envVars,
    setEnvVars,
    freeCompute,
    jobName,
    setJobName,
    mountedFiles,
    setMountedFiles,
    multiaddrsOrPeerId,
    outputBucketId,
    setOutputBucketId,
    selectedEnv,
    selectedResources,
    submitJob,
  } = useRunJobContext();
  const { bucketFiles, buckets, fetchBucketFiles, fetchBuckets, fetchingBuckets, fetchingFiles } = useNodeStorage();

  const [activeTab, setActiveTab] = useState<AuthoringTab>('algorithm');
  const [submitting, setSubmitting] = useState(false);
  const [expandedBucketId, setExpandedBucketId] = useState<string | null>(null);

  const nodeId = selectedEnv?.nodeId;
  const nodeBuckets = (nodeId && buckets[nodeId]) || [];

  // Load the node's buckets when the storage tab is first opened (auth prompts the wallet once).
  useEffect(() => {
    if (activeTab !== 'storage' || !nodeId || !multiaddrsOrPeerId || buckets[nodeId]) return;
    fetchBuckets({ nodeId, nodeUri: multiaddrsOrPeerId as NodeUri }).catch(() =>
      toast.error('Failed to load storage buckets for this node.')
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, nodeId, multiaddrsOrPeerId]);

  const toggleBucket = (bucketId: string) => {
    const next = expandedBucketId === bucketId ? null : bucketId;
    setExpandedBucketId(next);
    if (next && nodeId && multiaddrsOrPeerId && !bucketFiles[next]) {
      fetchBucketFiles({ bucketId: next, nodeId, nodeUri: multiaddrsOrPeerId as NodeUri }).catch(() =>
        toast.error('Failed to load bucket files.')
      );
    }
  };

  const isMounted = (bucketId: string, fileName: string) =>
    mountedFiles.some((mount) => mount.bucketId === bucketId && mount.fileName === fileName);

  const toggleMount = (bucketId: string, fileName: string) => {
    setMountedFiles(
      isMounted(bucketId, fileName)
        ? mountedFiles.filter((mount) => !(mount.bucketId === bucketId && mount.fileName === fileName))
        : [...mountedFiles, { bucketId, fileName }]
    );
  };

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

  // Extra Dockerfile build-context files (e.g. requirements.txt), sent alongside the Dockerfile.
  const handleBuildFilesUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    const added: Record<string, string> = {};
    for (const file of files) {
      added[file.name] = await file.text();
    }
    setAdditionalDockerFiles({ ...additionalDockerFiles, ...added });
    event.target.value = '';
  };

  const removeBuildFile = (name: string) => {
    const next = { ...additionalDockerFiles };
    delete next[name];
    setAdditionalDockerFiles(next);
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
          peerId: selectedEnv.nodeId,
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
      <Input
        type="text"
        label="Job name (optional)"
        placeholder="My experiment #1"
        value={jobName}
        onChange={(event) => setJobName(event.target.value)}
      />
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
            <span className={styles.fieldLabel}>Algorithm</span>
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
          <div className={styles.row}>
            <span className={styles.fieldLabel}>Build files</span>
            <Button
              color="accent1"
              onClick={() => buildFilesInputRef.current?.click()}
              size="sm"
              type="button"
              variant="outlined"
            >
              + Add build files
            </Button>
            <input
              ref={buildFilesInputRef}
              type="file"
              multiple
              className={styles.hiddenInput}
              onChange={handleBuildFilesUpload}
            />
          </div>
          {Object.keys(additionalDockerFiles).length === 0 ? (
            <p className={styles.muted}>
              Extra files for the Docker build context (e.g. requirements.txt). Sent only when a Dockerfile is
              provided.
            </p>
          ) : (
            Object.keys(additionalDockerFiles).map((name) => (
              <div key={name} className={styles.row}>
                <span>{name}</span>
                <Button color="accent1" onClick={() => removeBuildFile(name)} size="sm" type="button" variant="transparent">
                  Remove
                </Button>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'storage' && (
        <div className={styles.section}>
          <span className={styles.fieldLabel}>Output bucket (optional)</span>
          <p className={styles.muted}>Write the job&apos;s results into one of your persistent-storage buckets on this node.</p>
          <select
            className={styles.select}
            value={outputBucketId ?? ''}
            onChange={(event) => setOutputBucketId(event.target.value || null)}
          >
            <option value="">None — download results manually</option>
            {nodeBuckets.map((bucket) => (
              <option key={bucket.bucketId} value={bucket.bucketId}>
                {bucket.label || bucket.bucketId}
              </option>
            ))}
          </select>

          <span className={styles.fieldLabel}>Mount dataset files</span>
          <p className={styles.muted}>
            Mounted files are passed to the job as datasets, alongside the dataset from the Dataset tab.
          </p>
          {nodeId && fetchingBuckets[nodeId] && <p className={styles.muted}>Loading buckets…</p>}
          {nodeId && !fetchingBuckets[nodeId] && nodeBuckets.length === 0 && (
            <p className={styles.muted}>No persistent-storage buckets on this node yet.</p>
          )}
          {nodeBuckets.map((bucket) => (
            <div key={bucket.bucketId}>
              <button type="button" className={styles.bucketToggle} onClick={() => toggleBucket(bucket.bucketId)}>
                {expandedBucketId === bucket.bucketId ? '▾' : '▸'} {bucket.label || bucket.bucketId}
              </button>
              {expandedBucketId === bucket.bucketId && (
                <div className={styles.bucketFiles}>
                  {fetchingFiles[bucket.bucketId] && <p className={styles.muted}>Loading files…</p>}
                  {!fetchingFiles[bucket.bucketId] && (bucketFiles[bucket.bucketId] ?? []).length === 0 && (
                    <p className={styles.muted}>Empty bucket.</p>
                  )}
                  {(bucketFiles[bucket.bucketId] ?? []).map((file) => (
                    <Checkbox
                      key={file.name}
                      type="multiple"
                      checked={isMounted(bucket.bucketId, file.name)}
                      label={file.name}
                      onChange={() => toggleMount(bucket.bucketId, file.name)}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
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
        <div className="actionsGroupLgBetween">
          <Button
            color="accent1"
            onClick={() => router.replace({ pathname: '/run-job/summary', query: router.query })}
            size="lg"
            type="button"
            variant="transparent"
          >
            Back
          </Button>
          <Button autoLoading color="accent1" disabled={submitting} onClick={handleSubmit} size="lg" type="button">
            Submit job
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AuthoringPanel;
