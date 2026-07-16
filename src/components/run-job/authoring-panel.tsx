import Button from '@/components/button/button';
import Checkbox from '@/components/checkbox/checkbox';
import Input from '@/components/input/input';
import Select from '@/components/input/select';
import Modal from '@/components/modal/modal';
import { getRunJobSteps, type RunJobStep } from '@/components/stepper/get-steps';
import { useRunJobContext } from '@/context/run-job-context';
import { type NodeUri } from '@/contexts/P2PContext';
import { useNodeStorage } from '@/contexts/node-storage-context';
import { CURATED_IMAGES, detectLanguageFromFilename, type ImageSource, looksLikeDataset } from '@/lib/compute-inputs';
import { fetchDockerHubTags, orderTags } from '@/lib/dockerhub';
import { stashOptimisticJob } from '@/lib/optimistic-job';
import { formatDuration } from '@/utils/formatters';
import classNames from 'classnames';
import { useRouter } from 'next/router';
import posthog from 'posthog-js';
import { Fragment, useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import styles from './authoring-panel.module.css';

// The default image entry maps to this curated repo (oceanprotocol/c2d_examples); its tags are
// fetched live from Docker Hub.
const CURATED = CURATED_IMAGES[0];

// The 5 job sections shown as confirm/skip stepper pills, in order.
type SectionKey = 'image' | 'algorithm' | 'inputs' | 'env' | 'output';
const SECTION_TITLES: Record<SectionKey, string> = {
  image: 'Compute image',
  algorithm: 'Algorithm',
  inputs: 'Inputs',
  env: 'Environment variables',
  output: 'Output',
};

// Wizard-step routes for the in-card breadcrumb (Finish itself is the current page, so it has no route).
const STEP_ROUTES: Record<Exclude<RunJobStep, 'finish'>, string> = {
  environment: '/run-job/environments',
  resources: '/run-job/resources',
  payment: '/run-job/payment',
};

// Confirm-button label per section index (the shared action bar renders one of these).
const CONFIRM_LABELS = ['Confirm image', 'Confirm algorithm', 'Confirm inputs', 'Confirm env vars', 'Confirm output'];

// Friendly adjective-animal default job names (e.g. "quarrelsome-marten"), suggested in the confirm dialog.
const NAME_ADJECTIVES = ['quarrelsome', 'silky', 'misty', 'brave', 'clever', 'nimble', 'quiet', 'bold', 'gentle', 'swift'];
const NAME_ANIMALS = ['marten', 'heron', 'otter', 'lynx', 'falcon', 'badger', 'ibis', 'gecko', 'raven', 'shrew'];
const generateJobName = (): string => {
  const adj = NAME_ADJECTIVES[Math.floor(Math.random() * NAME_ADJECTIVES.length)];
  const animal = NAME_ANIMALS[Math.floor(Math.random() * NAME_ANIMALS.length)];
  return `${adj}-${animal}`;
};

const IMAGE_OPTIONS: { value: Exclude<ImageSource, ''>; label: string; desc: string }[] = [
  { value: 'default', label: CURATED.label, desc: 'Curated image with common ML libraries preinstalled.' },
  { value: 'custom', label: 'Custom image…', desc: 'Any public image and tag from Docker Hub.' },
  { value: 'dockerfile', label: 'Build from Dockerfile…', desc: 'Upload or paste a Dockerfile; the node builds it.' },
];

type AuthoringPanelProps = {
  authToken: string;
  consumerAddress: string;
};

const formatBytes = (bytes: number): string => {
  if (!bytes || bytes < 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${i === 0 ? value : value.toFixed(value < 10 ? 1 : 0)} ${units[i]}`;
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
    dockerImage,
    setDockerImage,
    dockerTag,
    setDockerTag,
    imageSource,
    setImageSource,
    entryMode,
    setEntryMode,
    entrypoint,
    setEntrypoint,
    checksum,
    setChecksum,
    envVars,
    setEnvVars,
    freeCompute,
    jobName,
    setJobName,
    mountedFiles,
    setMountedFiles,
    multiaddrsOrPeerId,
    nodeInfo,
    outputBucketId,
    setOutputBucketId,
    selectedEnv,
    selectedResources,
    selectedToken,
    estimatedTotalCost,
    submitJob,
  } = useRunJobContext();
  const { bucketFiles, buckets, fetchBucketFiles, fetchBuckets, fetchingBuckets, fetchingFiles } = useNodeStorage();

  // Confirm/skip stepper state. resolved[i]: 0 = open/unresolved, 1 = confirmed, 2 = skipped.
  // attempted[i] flags a required section whose Confirm was tried while invalid (to show the error).
  const [open, setOpen] = useState<number>(0);
  const [resolved, setResolved] = useState<number[]>([0, 0, 0, 0, 0]);
  const [attempted, setAttempted] = useState<number[]>([0, 0, 0, 0, 0]);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [expandedBucketId, setExpandedBucketId] = useState<string | null>(null);
  const [buildDragActive, setBuildDragActive] = useState(false);
  const [tagOptions, setTagOptions] = useState<string[]>(() => (imageSource === 'default' ? CURATED.knownTags : []));
  const [tagsLoading, setTagsLoading] = useState(false);

  // --- Derived validation ---
  const showEntry = imageSource === 'custom' || imageSource === 'dockerfile';
  const selfContained = showEntry && entryMode === 'self';
  const entryOk = !selfContained || entrypoint.trim().length > 0;
  const imageOk =
    imageSource === 'default' ||
    (imageSource === 'custom' && dockerImage.trim().length > 0) ||
    (imageSource === 'dockerfile' && dockerfile.trim().length > 0);
  const imageDone = imageOk && entryOk;
  const algoRequired = !selfContained;
  const algoOk = algorithmCode.trim().length > 0;
  const datasetWarning = dataset.trim() && !looksLikeDataset(dataset) ? 'Expected a DID, URL, IPFS hash, or Arweave id.' : '';

  const sections: { key: SectionKey; req: boolean; valid: boolean }[] = [
    { key: 'image', req: true, valid: imageDone },
    { key: 'algorithm', req: algoRequired, valid: algoOk },
    { key: 'inputs', req: false, valid: true },
    { key: 'env', req: false, valid: true },
    { key: 'output', req: false, valid: true },
  ];

  const allResolved = sections.every((s, i) => (s.req ? resolved[i] === 1 : resolved[i] !== 0));
  const ready = allResolved && imageDone && (!algoRequired || algoOk);
  const remainingCount = resolved.filter((r) => r === 0).length;

  const nodeId =
    typeof multiaddrsOrPeerId === 'string'
      ? multiaddrsOrPeerId
      : Array.isArray(multiaddrsOrPeerId)
        ? multiaddrsOrPeerId.join(',')
        : undefined;
  const nodeBuckets = (nodeId && buckets[nodeId]) || [];

  // Load the node's buckets when Inputs or Output is opened (auth prompts the wallet once).
  useEffect(() => {
    if ((open !== 2 && open !== 4) || !nodeId || !multiaddrsOrPeerId || buckets[nodeId]) return;
    fetchBuckets({ nodeId, nodeUri: multiaddrsOrPeerId as NodeUri }).catch(() =>
      toast.error('Failed to load storage buckets for this node.')
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, nodeId, multiaddrsOrPeerId]);

  // Fetch tags for the default (curated) image from Docker Hub. Falls back to knownTags on any failure
  // (CORS / network / rate limit). Auto-selects the first tag so the default is never left tag-less.
  useEffect(() => {
    if (imageSource !== 'default') {
      setTagOptions([]);
      return;
    }
    const controller = new AbortController();
    setTagsLoading(true);
    (async () => {
      let tags: string[];
      try {
        const fetched = await fetchDockerHubTags(CURATED.repo, controller.signal);
        tags = orderTags(fetched, CURATED.knownTags);
        if (tags.length === 0) tags = CURATED.knownTags;
      } catch {
        if (controller.signal.aborted) return;
        tags = CURATED.knownTags;
      }
      setTagOptions(tags);
      setTagsLoading(false);
      if ((!dockerTag || !tags.includes(dockerTag)) && tags.length > 0) {
        setDockerTag(tags[0]);
      }
    })();
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageSource]);

  // Picking an image source clears the other sources and resets the entry mode.
  const changeImageSource = (value: ImageSource) => {
    setImageSource(value);
    setEntryMode('algo');
    setEntrypoint('');
    setChecksum('');
    if (value === 'default') {
      setDockerImage('');
      setDockerfile('');
      setDockerTag('');
    } else if (value === 'custom') {
      setDockerfile('');
    } else if (value === 'dockerfile') {
      setDockerImage('');
      setDockerTag('');
    }
  };

  // --- Section resolution (confirm / skip / navigate) ---
  // Sections must be resolved strictly in order (1 → 5). The "gate" is the first still-unresolved
  // section: only sections up to and including it may be opened (earlier ones stay editable, later
  // ones stay locked). Once everything is resolved the gate opens fully so any section can be revisited.
  const firstUnresolvedIndex = (res: number[]): number => {
    const i = res.findIndex((r) => r === 0);
    return i === -1 ? 4 : i;
  };
  const gateIndex = firstUnresolvedIndex(resolved);

  const resolveSection = (i: number, value: 1 | 2) => {
    const nextResolved = [...resolved];
    nextResolved[i] = value;
    setResolved(nextResolved);
    const nextAttempted = [...attempted];
    nextAttempted[i] = 0;
    setAttempted(nextAttempted);
    // Advance to the next still-unresolved section in order; -1 → all done, show the review state.
    setOpen(nextResolved.findIndex((r) => r === 0));
  };
  const confirmSection = (i: number) => {
    const section = sections[i];
    if (section.req && !section.valid) {
      const next = [...attempted];
      next[i] = 1;
      setAttempted(next);
      return;
    }
    resolveSection(i, 1);
  };
  const skipSection = (i: number) => resolveSection(i, 2);
  // Block jumping ahead: only sections at or before the gate can be opened.
  const goSection = (i: number) => {
    if (i > gateIndex) return;
    setOpen(open === i ? -1 : i);
  };

  const toggleBucket = (bucketId: string) => {
    const next = expandedBucketId === bucketId ? null : bucketId;
    setExpandedBucketId(next);
    if (next && nodeId && multiaddrsOrPeerId && !bucketFiles[next]) {
      fetchBucketFiles({ bucketId: next, nodeId, nodeUri: multiaddrsOrPeerId as NodeUri }).catch(() =>
        toast.error('Failed to load bucket files.')
      );
    }
  };

  const refreshBuckets = () => {
    if (!nodeId || !multiaddrsOrPeerId) return;
    fetchBuckets({ nodeId, nodeUri: multiaddrsOrPeerId as NodeUri }).catch(() =>
      toast.error('Failed to load storage buckets for this node.')
    );
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

  const allMounted = (bucketId: string, fileNames: string[]) =>
    fileNames.length > 0 && fileNames.every((fileName) => isMounted(bucketId, fileName));

  const toggleAllInBucket = (bucketId: string, fileNames: string[]) => {
    if (allMounted(bucketId, fileNames)) {
      setMountedFiles(mountedFiles.filter((mount) => mount.bucketId !== bucketId));
      return;
    }
    const missing = fileNames
      .filter((fileName) => !isMounted(bucketId, fileName))
      .map((fileName) => ({ bucketId, fileName }));
    setMountedFiles([...mountedFiles, ...missing]);
  };

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
  const addBuildFiles = async (files: File[]) => {
    if (files.length === 0) return;
    const added: Record<string, string> = {};
    for (const file of files) {
      added[file.name] = await file.text();
    }
    setAdditionalDockerFiles({ ...additionalDockerFiles, ...added });
  };

  const handleBuildFilesUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    await addBuildFiles(Array.from(event.target.files ?? []));
    event.target.value = '';
  };

  const handleBuildFilesDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setBuildDragActive(false);
    await addBuildFiles(Array.from(event.dataTransfer.files ?? []));
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

  // "Submit job" gates on readiness, then opens the confirm dialog (where the job is named + started).
  const openConfirm = () => {
    if (!ready) {
      // Open the first unresolved / invalid required section and flag it.
      const firstOpen = resolved.findIndex((r) => r === 0);
      if (firstOpen >= 0) setOpen(firstOpen);
      setAttempted(sections.map((s, i) => (s.req && !s.valid ? 1 : attempted[i])));
      return;
    }
    // Suggest an editable friendly name so the field is never confusingly empty.
    if (!jobName.trim()) setJobName(generateJobName());
    setConfirmOpen(true);
  };

  const runSubmit = async () => {
    setSubmitting(true);
    try {
      const job = await submitJob({ authToken, consumerAddress });
      if (selectedEnv && selectedResources) {
        // computeStart returns `<clusterHash>-<uuid>`, but the indexer stores the bare `<uuid>`.
        // Stash the bare form so the optimistic row matches (and is replaced by) the indexed row,
        // and so buildNodeJobId doesn't double-prefix the cluster hash.
        const clusterHash = selectedEnv.id.split('-')[0];
        const bareJobId =
          clusterHash && job.jobId.startsWith(`${clusterHash}-`) ? job.jobId.slice(clusterHash.length + 1) : job.jobId;
        stashOptimisticJob({
          jobId: bareJobId,
          consumer: consumerAddress,
          environmentId: selectedEnv.id,
          peerId: nodeInfo?.id ?? selectedEnv.nodeId,
          multiaddrs: Array.isArray(multiaddrsOrPeerId) ? multiaddrsOrPeerId : undefined,
          isFree: freeCompute,
          dateCreated: Math.floor(Date.now() / 1000),
          maxJobDuration: selectedResources.maxJobDurationSeconds,
          jobName: jobName.trim() || undefined,
        });
      }
      posthog.capture('dashboard_job_submitted', {
        environmentId: selectedEnv?.id,
        freeCompute,
        hasDataset: !!dataset.trim(),
        hasCustomDockerfile: !!dockerfile.trim(),
        hasCustomImage: !dockerfile.trim() && !!dockerImage.trim(),
        selfContained,
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

  // --- Section chip (status tag next to each open section title) ---
  const sectionChip = (i: number) => {
    const s = sections[i];
    if (resolved[i] === 1) return { text: 'Done ✓', cls: styles.chipDone };
    if (resolved[i] === 2) return { text: 'Skipped', cls: styles.chipSkip };
    if (s.req && attempted[i] && !s.valid) return { text: 'Missing', cls: styles.chipMiss };
    if (s.req) return { text: 'Required', cls: styles.chipReq };
    return { text: 'Optional', cls: styles.chipOpt };
  };

  const mountCount = mountedFiles.length;

  const diskTooltipNote = 'Mounted files are passed to the job as datasets, alongside the dataset above.';

  // Human-readable image summary for the confirm dialog.
  const imageSummary =
    imageSource === 'default'
      ? `${CURATED.label}${dockerTag ? `:${dockerTag}` : ''}`
      : imageSource === 'custom'
        ? `${dockerImage || 'custom image'}:${dockerTag || 'latest'}`
        : imageSource === 'dockerfile'
          ? 'Built from Dockerfile'
          : '—';

  // Validation error shown in the shared action bar for the currently-open section (§0 image, §1 algorithm).
  const openError =
    open === 0 && attempted[0] === 1 && !imageDone
      ? imageOk
        ? 'Set the entrypoint command before confirming.'
        : 'Pick an image — the default also counts.'
      : open === 1 && attempted[1] === 1 && algoRequired && !algoOk
        ? 'Add your algorithm code — or make the image self-contained.'
        : '';

  return (
    <div className={styles.root}>
      <div className={styles.pageHeader}>
        <nav className={styles.breadcrumb} aria-label="Run a job steps">
          {getRunJobSteps(freeCompute)
            .filter((step) => !step.hidden)
            .map((step, index) => {
              const isFinish = step.key === 'finish';
              return (
                <Fragment key={step.key}>
                  {index > 0 && <span className={styles.crumbSep}>·</span>}
                  {isFinish ? (
                    <span className={styles.crumbActive} aria-current="step">
                      {step.label}
                    </span>
                  ) : (
                    <button
                      type="button"
                      className={styles.crumbLink}
                      onClick={() =>
                        router.push({
                          pathname: STEP_ROUTES[step.key as Exclude<RunJobStep, 'finish'>],
                          query: router.query,
                        })
                      }
                    >
                      {index === 0 ? `‹ ${step.label}` : step.label}
                    </button>
                  )}
                </Fragment>
              );
            })}
        </nav>
        <h3 className={styles.pageTitle}>Configure your job</h3>
      </div>

      {/* Stepper pills — each section confirmed (lime), skipped (grey) or open/required (coral). */}
      <div className={styles.stepper} role="tablist" aria-label="Job sections">
        {sections.map((s, i) => {
          const isOpen = open === i;
          const done = resolved[i] === 1;
          const skipped = resolved[i] === 2;
          const locked = i > gateIndex;
          return (
            <div key={s.key} className={styles.pillWrap}>
              <button
                type="button"
                role="tab"
                aria-selected={isOpen}
                disabled={locked}
                aria-disabled={locked}
                onClick={() => goSection(i)}
                className={classNames(styles.pill, {
                  [styles.pillOpen]: isOpen,
                  [styles.pillDone]: done && !isOpen,
                  [styles.pillSkipped]: skipped && !isOpen,
                  [styles.pillReq]: !isOpen && !done && !skipped && !locked && s.req,
                  [styles.pillLocked]: locked,
                })}
              >
                <span className={styles.pillMark}>{done ? '✓' : skipped ? '–' : i + 1}</span>
                {SECTION_TITLES[s.key]}
              </button>
              {i < sections.length - 1 && <span className={styles.pillConn} />}
            </div>
          );
        })}
      </div>
      <span className={styles.remaining}>
        {ready
          ? 'All sections resolved — ready to go.'
          : remainingCount > 0
            ? `${remainingCount} section${remainingCount === 1 ? '' : 's'} left to confirm or skip.`
            : 'Fix the required sections marked in coral.'}
      </span>

      <div className={styles.sectionBox}>
        {open < 0 && (
          <div className={styles.reviewState}>
            <span className={styles.reviewTitle}>All sections resolved</span>
            <span className={styles.reviewHint}>
              Click any pill above to reopen a section, then submit your job below.
            </span>
          </div>
        )}

        {/* --- Section 0: Compute image (required) --- */}
        {open === 0 && (
          <div className={styles.section}>
            <div className={styles.sectionTitleRow}>
              <span className={styles.sectionTitle}>Compute image</span>
              <span className={classNames(styles.chip, sectionChip(0).cls)}>{sectionChip(0).text}</span>
            </div>
            <div className={styles.imageRow}>
              <div className={styles.imageCol}>
                <Select<ImageSource>
                  label="Image"
                  placeholder="Choose an image…"
                  options={IMAGE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                  renderOption={(o) => (
                    <div className={styles.optionRow}>
                      <div className={styles.optionText}>
                        <span className={styles.optionLabel}>{o.label}</span>
                        <span className={styles.optionDesc}>{IMAGE_OPTIONS.find((x) => x.value === o.value)?.desc}</span>
                      </div>
                      {o.value === imageSource && <span className={styles.optionCheck}>✓</span>}
                    </div>
                  )}
                  value={imageSource || undefined}
                  onChange={(e) => changeImageSource(e.target.value as ImageSource)}
                />
              </div>
              {imageSource === 'default' && (
                <div className={styles.tagCol}>
                  <Select
                    label="Tag"
                    placeholder={tagsLoading ? 'Loading…' : 'Select a tag'}
                    disabled={tagsLoading}
                    options={tagOptions.map((t) => ({ value: t, label: t }))}
                    renderOption={(o) => (
                      <div className={styles.optionRow}>
                        <span className={styles.optionLabel}>{o.label}</span>
                        {o.value === dockerTag && <span className={styles.optionCheck}>✓</span>}
                      </div>
                    )}
                    value={dockerTag}
                    onChange={(e) => setDockerTag(e.target.value as string)}
                  />
                </div>
              )}
            </div>
            <span className={styles.hint}>
              Pick a ready-made image, Custom for your own, or build one from a Dockerfile. The default is fine for most
              Python jobs.
            </span>

            {imageSource === 'custom' && (
              <div className={styles.imageRow}>
                <div className={styles.imageCol}>
                  <Input
                    type="text"
                    label="Image"
                    placeholder="e.g. pytorch/pytorch"
                    value={dockerImage}
                    onChange={(e) => setDockerImage(e.target.value)}
                  />
                </div>
                <div className={styles.tagCol}>
                  <Input
                    type="text"
                    label="Tag"
                    placeholder="latest"
                    value={dockerTag}
                    onChange={(e) => setDockerTag(e.target.value)}
                  />
                </div>
              </div>
            )}

            {imageSource === 'dockerfile' && (
              <div className={styles.section}>
                <div className={styles.row}>
                  <span className={styles.fieldLabel}>Dockerfile</span>
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
                  className={classNames(styles.codeEditor, styles.dockerEditor)}
                  placeholder={'FROM python:3.11-slim …\nDo not set your own ENTRYPOINT/CMD unless the image is self-contained.'}
                  spellCheck={false}
                  value={dockerfile}
                  onChange={(e) => setDockerfile(e.target.value)}
                />
                <div className={styles.sectionHeader}>
                  <span className={styles.fieldLabel}>Build files</span>
                  {Object.keys(additionalDockerFiles).length > 0 && (
                    <span className={styles.badge}>{Object.keys(additionalDockerFiles).length}</span>
                  )}
                </div>
                <input ref={buildFilesInputRef} type="file" multiple className={styles.hiddenInput} onChange={handleBuildFilesUpload} />
                <div
                  className={classNames(styles.dropzone, { [styles.dropzoneActive]: buildDragActive })}
                  role="button"
                  tabIndex={0}
                  onClick={() => buildFilesInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      buildFilesInputRef.current?.click();
                    }
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setBuildDragActive(true);
                  }}
                  onDragLeave={() => setBuildDragActive(false)}
                  onDrop={handleBuildFilesDrop}
                >
                  <span className={styles.dropzoneTitle}>Drop files here or click to browse</span>
                  <span className={styles.dropzoneHint}>Extra files for the Docker build context (e.g. requirements.txt).</span>
                </div>
                {Object.keys(additionalDockerFiles).length > 0 && (
                  <div className={styles.fileChips}>
                    {Object.entries(additionalDockerFiles).map(([name, content]) => (
                      <div key={name} className={styles.fileChip}>
                        <span className={styles.fileChipIcon}>📄</span>
                        <span className={styles.fileChipName}>{name}</span>
                        <span className={styles.fileSize}>{formatBytes(new Blob([content]).size)}</span>
                        <button type="button" className={styles.chipRemove} aria-label={`Remove ${name}`} onClick={() => removeBuildFile(name)}>
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {showEntry && (
              <div className={styles.entryPanel}>
                <span className={styles.fieldLabel}>How does the job start?</span>
                <div className={styles.entryGrid}>
                  {[
                    { id: 'algo' as const, title: 'Run my algorithm', desc: 'The node injects your code as $ALGO and runs it. Algorithm required.' },
                    { id: 'self' as const, title: 'Image is self-contained', desc: 'Your entrypoint runs code baked into the image. Algorithm becomes optional.' },
                  ].map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => setEntryMode(e.id)}
                      className={classNames(styles.entryCard, { [styles.entryCardSel]: entryMode === e.id })}
                    >
                      <span className={styles.entryCardTitle}>
                        <span className={styles.entryDot} />
                        {e.title}
                      </span>
                      <span className={styles.entryCardDesc}>{e.desc}</span>
                    </button>
                  ))}
                </div>
                {selfContained && (
                  <div className={styles.imageRow}>
                    <div className={styles.imageCol}>
                      <Input
                        type="text"
                        label="Entrypoint"
                        placeholder="e.g. python /app/main.py"
                        value={entrypoint}
                        onChange={(e) => setEntrypoint(e.target.value)}
                        errorText={attempted[0] === 1 && selfContained && !entrypoint.trim() ? 'Entrypoint is required.' : undefined}
                      />
                    </div>
                    <div className={styles.tagCol}>
                      <Input
                        type="text"
                        label="Checksum (optional)"
                        placeholder="sha256:…"
                        value={checksum}
                        onChange={(e) => setChecksum(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        )}

        {/* --- Section 1: Algorithm (required unless self-contained) --- */}
        {open === 1 && (
          <div className={styles.section}>
            <div className={styles.sectionTitleRow}>
              <span className={styles.sectionTitle}>Algorithm</span>
              <span className={classNames(styles.chip, sectionChip(1).cls)}>{sectionChip(1).text}</span>
              <span className={styles.spacer} />
              <span className={styles.langToggle}>
                {(['py', 'js'] as const).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setAlgorithmLanguage(lang)}
                    className={classNames(styles.langBtn, { [styles.langBtnActive]: algorithmLanguage === lang })}
                  >
                    {lang === 'py' ? 'Python' : 'JavaScript'}
                  </button>
                ))}
              </span>
              <label className={styles.uploadBtn}>
                Upload .py / .js
                <input type="file" accept=".py,.js,.txt" className={styles.hiddenInput} onChange={handleUpload} />
              </label>
            </div>
            <textarea
              className={classNames(styles.codeEditor, styles.algoEditor)}
              placeholder="Paste your algorithm here, or upload a .py / .js file."
              spellCheck={false}
              value={algorithmCode}
              onChange={(e) => setAlgorithmCode(e.target.value)}
            />
            {!algoOk && (
              <span className={styles.hint}>
                {algoRequired
                  ? 'Required — paste code or upload a file. Pick the language with the toggle.'
                  : 'Optional — your image’s entrypoint runs its own baked-in code.'}
              </span>
            )}
          </div>
        )}

        {/* --- Section 2: Inputs (optional) — dataset + mounted bucket files --- */}
        {open === 2 && (
          <div className={styles.section}>
            <div className={styles.sectionTitleRow}>
              <span className={styles.sectionTitle}>Inputs</span>
              <span className={classNames(styles.chip, sectionChip(2).cls)}>{sectionChip(2).text}</span>
              <span className={styles.muted}>Everything the job reads — external refs and mounted bucket files.</span>
            </div>
            <Input
              type="text"
              label="Dataset"
              placeholder="did:op:… or https://… or Qm…"
              hint={datasetWarning || 'DID, URL, IPFS hash, or Arweave id. Leave empty if your algorithm fetches its own data.'}
              errorText={datasetWarning || undefined}
              value={dataset}
              onChange={(e) => setDataset(e.target.value)}
            />
            <div className={styles.sectionHeader}>
              <div className={styles.sectionHeaderText}>
                <span className={styles.fieldLabel}>
                  Mount dataset files <span className={styles.muted}>— {mountCount} selected</span>
                </span>
                <p className={styles.muted}>{diskTooltipNote}</p>
              </div>
              <button
                type="button"
                className={styles.linkButton}
                onClick={refreshBuckets}
                disabled={!nodeId || (nodeId ? fetchingBuckets[nodeId] : false)}
              >
                Refresh
              </button>
            </div>
            {nodeId && fetchingBuckets[nodeId] && <p className={styles.muted}>Loading buckets…</p>}
            {nodeId && !fetchingBuckets[nodeId] && nodeBuckets.length === 0 && (
              <div className={styles.emptyState}>No persistent-storage buckets on this node yet.</div>
            )}
            {nodeBuckets.length > 0 && (
              <div className={styles.bucketList}>
                {nodeBuckets.map((bucket) => {
                  const isOpen = expandedBucketId === bucket.bucketId;
                  const files = bucketFiles[bucket.bucketId] ?? [];
                  const loaded = !!bucketFiles[bucket.bucketId];
                  const mountedInBucket = mountedFiles.filter((mount) => mount.bucketId === bucket.bucketId).length;
                  return (
                    <div key={bucket.bucketId} className={classNames(styles.bucketCard, { [styles.bucketCardOpen]: isOpen })}>
                      <button type="button" className={styles.bucketCardHeader} onClick={() => toggleBucket(bucket.bucketId)}>
                        <span className={classNames(styles.chevron, { [styles.chevronOpen]: isOpen })}>▶</span>
                        <span className={styles.bucketName}>{bucket.label || bucket.bucketId}</span>
                        <span className={styles.bucketMeta}>
                          {mountedInBucket > 0 ? `${mountedInBucket} selected` : loaded ? `${files.length} files` : ''}
                        </span>
                      </button>
                      {isOpen && (
                        <div className={styles.fileList}>
                          {fetchingFiles[bucket.bucketId] && <p className={styles.muted}>Loading files…</p>}
                          {!fetchingFiles[bucket.bucketId] && files.length === 0 && <p className={styles.muted}>Empty bucket.</p>}
                          {!fetchingFiles[bucket.bucketId] && files.length > 0 && (
                            <label className={classNames(styles.fileRow, styles.selectAllRow)}>
                              <Checkbox
                                className={styles.fileRowLabel}
                                type="multiple"
                                checked={allMounted(
                                  bucket.bucketId,
                                  files.map((file) => file.name)
                                )}
                                label={`Select all (${files.length})`}
                                onChange={() =>
                                  toggleAllInBucket(
                                    bucket.bucketId,
                                    files.map((file) => file.name)
                                  )
                                }
                              />
                            </label>
                          )}
                          {files.map((file) => {
                            const selected = isMounted(bucket.bucketId, file.name);
                            return (
                              <label key={file.name} className={classNames(styles.fileRow, { [styles.fileRowSelected]: selected })}>
                                <Checkbox
                                  className={styles.fileRowLabel}
                                  type="multiple"
                                  checked={selected}
                                  label={file.name}
                                  onChange={() => toggleMount(bucket.bucketId, file.name)}
                                />
                                <span className={styles.fileSize}>{formatBytes(file.size)}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* --- Section 3: Env vars (optional) --- */}
        {open === 3 && (
          <div className={styles.section}>
            <div className={styles.sectionTitleRow}>
              <span className={styles.sectionTitle}>Environment variables</span>
              <span className={classNames(styles.chip, sectionChip(3).cls)}>{sectionChip(3).text}</span>
            </div>
            {envVars.length === 0 && <p className={styles.muted}>No environment variables.</p>}
            {envVars.map((entry, index) => (
              <div key={index} className={styles.envRow}>
                <Input type="text" placeholder="KEY" value={entry.key} onChange={(e) => updateEnvVar(index, { key: e.target.value })} />
                <Input type="text" placeholder="value" value={entry.value} onChange={(e) => updateEnvVar(index, { value: e.target.value })} />
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

        {/* --- Section 4: Output (optional) --- */}
        {open === 4 && (
          <div className={styles.section}>
            <div className={styles.sectionTitleRow}>
              <span className={styles.sectionTitle}>Output</span>
              <span className={classNames(styles.chip, sectionChip(4).cls)}>{sectionChip(4).text}</span>
              <span className={styles.muted}>Where results go — the opposite direction from Inputs.</span>
            </div>
            <div className={styles.outputSelect}>
              <Select
                label="Output bucket"
                hint="Write the job’s results into one of your persistent-storage buckets on this node."
                options={[
                  { value: 'none', label: 'None — download results manually' },
                  ...nodeBuckets.map((bucket) => ({ value: bucket.bucketId, label: bucket.label || bucket.bucketId })),
                ]}
                value={outputBucketId ?? 'none'}
                onChange={(e) => {
                  const value = e.target.value as string;
                  setOutputBucketId(value === 'none' ? null : value);
                }}
              />
            </div>
          </div>
        )}

        {open >= 0 && (
          <div className={styles.sectionActions}>
            {openError && <span className={styles.sectionError}>{openError}</span>}
            <span className={styles.spacer} />
            {!sections[open].req && (
              <Button color="accent1" onClick={() => skipSection(open)} size="sm" type="button" variant="transparent">
                Skip
              </Button>
            )}
            <Button color="accent1" onClick={() => confirmSection(open)} size="sm" type="button" variant="outlined">
              {CONFIRM_LABELS[open]}
            </Button>
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <Button
          color="accent1"
          onClick={() => router.replace({ pathname: '/run-job/summary', query: router.query })}
          size="lg"
          type="button"
          variant="transparent"
        >
          Back
        </Button>
        <Button color="accent1" disabled={submitting || !ready} onClick={openConfirm} size="lg" type="button">
          Submit job
        </Button>
      </div>

      <Modal isOpen={confirmOpen} onClose={() => setConfirmOpen(false)} title="Start this job?" width="xs" fullWidth>
        <div className={styles.confirmBody}>
          <label className={styles.confirmField}>
            <span className={styles.fieldLabel}>Job name</span>
            <Input
              type="text"
              placeholder="Name this job"
              value={jobName}
              onChange={(e) => setJobName(e.target.value)}
            />
            <span className={styles.hint}>A friendly label so you can find this run later. Optional.</span>
          </label>

          <div className={styles.confirmSummary}>
            <span className={styles.confirmSummaryLabel}>Compute</span>
            <span className={styles.confirmSummaryValue}>
              {freeCompute ? 'Free' : `${estimatedTotalCost ?? '—'}${selectedToken ? ` ${selectedToken.symbol}` : ''}`}
            </span>
            <span className={styles.confirmSummaryLabel}>Image</span>
            <span className={styles.confirmSummaryValue}>{imageSummary}</span>
            {selectedResources && (
              <>
                <span className={styles.confirmSummaryLabel}>Duration</span>
                <span className={styles.confirmSummaryValue}>
                  {formatDuration(selectedResources.maxJobDurationSeconds)}
                </span>
              </>
            )}
          </div>

          <div className="actionsGroupMdEnd">
            <Button color="accent1" onClick={() => setConfirmOpen(false)} size="md" type="button" variant="outlined">
              Cancel
            </Button>
            <Button autoLoading color="accent1" disabled={submitting} onClick={runSubmit} size="md" type="button">
              Start job
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AuthoringPanel;
