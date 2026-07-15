import Card from '@/components/card/card';
import Container from '@/components/container/container';
import useInferenceAllocation from '@/components/hooks/use-inference-allocation';
import InferenceEnvironmentCard from '@/components/inference/inference-environment-card';
import InferenceHydrationError from '@/components/inference/inference-hydration-error';
import InferenceModelList, { ServiceModel } from '@/components/inference/inference-model-list';
import InferenceNavigation from '@/components/inference/inference-navigation';
import InferenceStepper from '@/components/inference/inference-stepper';
import PaymentSummary from '@/components/run-job/payment-summary';
import SectionTitle from '@/components/section-title/section-title';
import { CHAIN_ID } from '@/constants/chains';
import { useInferenceContext } from '@/context/inference-context';
import { useP2P } from '@/contexts/P2PContext';
import { useNodeAuth } from '@/contexts/node-auth-context';
import { useOceanAccount } from '@/lib/use-ocean-account';
import { DEFAULT_MAX_LOCK_COUNT, usePaySession } from '@/lib/use-pay-session';
import { usePaymentInfo } from '@/lib/use-payment-info';
import { buildInferenceStartParams, buildUserData, buildVllmCommand, toNodeUri } from '@/services/inference-launch';
import { InferenceFlowType } from '@/types/inference';
import { formatDuration, roundTokenAmount } from '@/utils/formatters';
import { usePrivy } from '@privy-io/react-auth';
import { CircularProgress } from '@mui/material';
import { useParams } from 'next/navigation';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './payment-page.module.css';

const PaymentPage: React.FC<{ flowType: InferenceFlowType }> = ({ flowType }) => {
  const params = useParams<{ modelId?: string; templateId?: string }>();
  const router = useRouter();
  const isCustomModelFlow = flowType === InferenceFlowType.CustomModel;
  // Editing a running service: same env, no re-pay — hide the payment summary and relaunch instead.
  const isEditMode = router.query.edit === '1';
  // Prolonging a running service: same selection, pay only for the extra runtime. Skips the earlier
  // steps (arrived straight from the manage page) — jobDurationSeconds holds the extra time to add.
  const isProlongMode = router.query.prolong === '1';
  const {
    selectedEnv,
    selectedToken,
    jobDurationSeconds,
    selectedModels,
    modelParamsByModel,
    hfToken,
    hydrateFromUrlFinished,
    hydrationFailed,
    buildSelectionQuery,
  } = useInferenceContext();
  const { account } = useOceanAccount();
  const { login } = usePrivy();
  const { isReady, serviceExtend, serviceStart, serviceRestart } = useP2P();
  const { withNodeAuth } = useNodeAuth();
  const { handlePay } = usePaySession();
  // The running service targeted by edit/prolong — set by the manage page when re-entering the flow.
  const targetServiceId = Array.isArray(router.query.serviceId) ? router.query.serviceId[0] : router.query.serviceId;

  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);

  // Pair each selected model with the launch params committed in the config step. Params come
  // straight from context (no fallback) — a model without them renders its values as N/A.
  const models: ServiceModel[] = useMemo(
    () => selectedModels.map((model) => ({ model, params: modelParamsByModel[model.id] })),
    [selectedModels, modelParamsByModel]
  );

  // Same CPU/RAM/disk allocation shown in the payment summary — reused to size the launch request,
  // and the same price — reused to size the escrow deposit/authorization before launching.
  // Safe fallbacks keep the hook unconditional; real values only matter once selectedEnv/token exist.
  const { allocation, price } = useInferenceAllocation({
    environment: selectedEnv?.environment ?? ({ resources: [] } as any),
    tokenAddress: selectedToken?.address ?? '',
    gpuSelection: selectedEnv?.gpuSelection,
    durationSeconds: jobDurationSeconds,
  });

  // The node locks funds for `duration + claimDurationTimeout` and rejects the lock (→ service
  // never starts, "maxLockSeconds too low") if the escrow authorization's window is shorter. The
  // claim timeout is node config, NOT advertised to clients (default 3600s but nodes set it much
  // higher). We can't compute the exact requirement, so authorize a generous buffer beyond the
  // duration that covers any realistic claim timeout. The window is only a permission ceiling — it
  // locks no extra funds — so over-authorizing is free.
  const ESCROW_LOCK_BUFFER_SECONDS = 86_400; // 1 day, comfortably above typical claimDurationTimeout
  const escrowLockSeconds = jobDurationSeconds + ESCROW_LOCK_BUFFER_SECONDS;

  // Escrow state shown in the payment summary — same hook as the run-job payment step. The launch
  // handler re-reads it at click time (loadPaymentInfo resolves with a fresh snapshot).
  const {
    authorizations,
    escrowBalance,
    walletBalance,
    loading: loadingPaymentInfo,
    loadError: paymentInfoError,
    loadPaymentInfo,
  } = usePaymentInfo(selectedToken?.address ?? '', selectedEnv?.environment.consumerAddress ?? '');

  // Round up so float noise never under-quotes the required balance/allowance.
  const totalCost = useMemo(
    () => (selectedToken ? roundTokenAmount(price, selectedToken.address, 'up') : 0),
    [price, selectedToken]
  );

  // Make sure escrow can cover this payment before launching: same deposit-gap + re-authorization
  // math as the run-job payment step, executed through the same Escrow.bundle path (usePaySession —
  // one bundle tx on EOAs, approve + bundle batched on smart accounts). No-op when the current
  // state already suffices; throws on failure so the launch is aborted.
  const ensureEscrowForSelection = useCallback(async () => {
    if (!selectedEnv || !selectedToken || totalCost <= 0) {
      return;
    }
    const info = await loadPaymentInfo();
    if (!info) {
      throw new Error('Failed to load payment info.');
    }
    const tokenAddress = selectedToken.address;
    const auth = info.authorizations;
    const depositAmount = roundTokenAmount(Math.max(0, totalCost - info.escrowBalance), tokenAddress, 'up');
    const currentLockedAmount = Number(auth?.currentLockedAmount ?? 0);
    const requiredMaxLocked = roundTokenAmount(totalCost + currentLockedAmount, tokenAddress, 'up');
    const sufficientAuthorization =
      !!auth &&
      roundTokenAmount(Number(auth.maxLockedAmount), tokenAddress) >= requiredMaxLocked &&
      Number(auth.maxLockSeconds) >= escrowLockSeconds &&
      Number(auth.currentLocks) < Number(auth.maxLockCounts);
    if (depositAmount <= 0 && sufficientAuthorization) {
      return;
    }
    if (info.walletBalance < depositAmount) {
      throw new Error(
        `Insufficient wallet balance: need ${depositAmount} more in escrow but only ${info.walletBalance} available.`
      );
    }
    // Re-authorizing overwrites the previous grant, so the new one must cover both the running
    // locks and this payment, keep at least the lock window this service needs, and never shrink
    // limits already granted. Lock count always leaves a free slot (run-job formula).
    const maxLockedAmount = Math.max(
      requiredMaxLocked,
      roundTokenAmount(Number(auth?.maxLockedAmount ?? 0), tokenAddress)
    );
    const maxLockSeconds = Math.max(Math.ceil(escrowLockSeconds), Number(auth?.maxLockSeconds ?? 0));
    const maxLockCount = Math.max(
      DEFAULT_MAX_LOCK_COUNT,
      Number(auth?.currentLocks ?? 0) + 1,
      Number(auth?.maxLockCounts ?? 0)
    );
    const paid = await handlePay({
      tokenAddress,
      peerId: selectedEnv.nodeInfo.id,
      spender: selectedEnv.environment.consumerAddress,
      depositAmount: depositAmount.toString(),
      maxLockedAmount: maxLockedAmount.toString(),
      maxLockSeconds: maxLockSeconds.toString(),
      maxLockCount: maxLockCount.toString(),
    });
    if (!paid) {
      throw new Error('Escrow payment was not completed.');
    }
  }, [selectedEnv, selectedToken, totalCost, escrowLockSeconds, loadPaymentInfo, handlePay]);

  // Bounce back to the earliest step whose input is missing if we landed here (deep link / refresh)
  // without a complete selection: no models → picker, no env → resources, unconfigured model → config.
  // Skipped when hydration failed — we show a retry instead of discarding the URL selection.
  useEffect(() => {
    if (!isCustomModelFlow || !hydrateFromUrlFinished || hydrationFailed) {
      return;
    }
    if (selectedModels.length === 0) {
      router.replace({ pathname: '/inference/custom-models', query: router.query });
    } else if (!selectedEnv && !isEditMode && !isProlongMode) {
      // In edit/prolong mode the env is inherited from the running service and the resources step is skipped.
      router.replace({ pathname: '/inference/custom-models/resources', query: router.query });
    } else if (!isProlongMode && selectedModels.some((model) => !modelParamsByModel[model.id])) {
      // Prolong reuses the running service's committed params — no config step to bounce back to.
      router.replace({ pathname: '/inference/custom-models/config', query: router.query });
    }
  }, [
    isCustomModelFlow,
    hydrateFromUrlFinished,
    hydrationFailed,
    selectedModels,
    selectedEnv,
    modelParamsByModel,
    isEditMode,
    isProlongMode,
    router,
  ]);

  const goToPrevStep = () => {
    // Prolong arrived straight from the manage page — go back there instead of into the flow steps.
    if (isProlongMode) {
      router.back();
      return;
    }
    switch (flowType) {
      case InferenceFlowType.CustomModel: {
        router.replace({ pathname: '/inference/custom-models/config', query: router.query });
        break;
      }
      case InferenceFlowType.DefaultModel: {
        router.replace(`/inference/default-models/${encodeURIComponent(params.modelId ?? '')}/resources`);
        break;
      }
      case InferenceFlowType.Template: {
        router.replace(`/inference/templates/${encodeURIComponent(params.templateId ?? '')}/config`);
        break;
      }
    }
  };

  // Build the query for the manage page after a launch/extend. Carries the whole selection so a
  // hard reload can rehydrate it, but drops the flow flags — `edit`/`serviceId` must not leak into
  // the manage page URL or a later prolong/edit re-entry would inherit the wrong mode.
  const buildManageQuery = useCallback(() => {
    const { edit: _edit, serviceId: _serviceId, ...query } = buildSelectionQuery();
    return query;
  }, [buildSelectionQuery]);

  // Prolong: extend the running service's lifetime by jobDurationSeconds (the extra time picked in
  // the modal). No new container — serviceExtend charges the extra runtime against the same escrow
  // flow as the initial start.
  const prolongService = useCallback(async () => {
    if (!targetServiceId || !selectedEnv || !selectedToken || !account.address) {
      setLaunchError('Selection incomplete — missing service, environment, token or wallet.');
      return;
    }
    if (jobDurationSeconds <= 0) {
      setLaunchError('Pick a duration greater than zero.');
      return;
    }
    // The node rejects an extension that pushes total runtime past its max (serviceExtend: 400
    // "remaining + additionalDuration > maxDurationSeconds"). We can't see the node's exact cap or
    // the live remaining runtime here, but the env's advertised maxJobDuration bounds a single
    // window — if the extra time alone already exceeds it the extend is guaranteed to fail, so stop
    // before paying the (wasted) escrow deposit tx.
    const envMax = selectedEnv.environment.maxJobDuration;
    if (envMax && jobDurationSeconds > envMax) {
      setLaunchError(
        `The extra time exceeds this environment's maximum session length (${formatDuration(envMax)}). Pick a shorter extension.`
      );
      return;
    }

    setLaunching(true);
    setLaunchError(null);
    try {
      // The node locks the extension cost in escrow — top up funds/authorization first if needed.
      await ensureEscrowForSelection();
      const nodeUri = toNodeUri(selectedEnv.nodeInfo);
      await withNodeAuth(selectedEnv.nodeInfo.id, nodeUri, (token) =>
        serviceExtend(nodeUri, token, targetServiceId, jobDurationSeconds, {
          chainId: CHAIN_ID,
          token: selectedToken.address,
        })
      );
      router.push({
        pathname: `/inference/services/${encodeURIComponent(targetServiceId)}`,
        query: buildManageQuery(),
      });
    } catch (error) {
      console.error('Failed to prolong inference service:', error);
      setLaunchError(error instanceof Error ? error.message : 'Failed to prolong service.');
    } finally {
      setLaunching(false);
    }
  }, [
    targetServiceId,
    selectedEnv,
    selectedToken,
    account.address,
    withNodeAuth,
    jobDurationSeconds,
    ensureEscrowForSelection,
    serviceExtend,
    router,
    buildManageQuery,
  ]);

  // Edit relaunch: apply the new model/settings to the SAME running service via serviceRestart.
  // The node reuses the existing serviceId, host port and expiry — so the endpoint URL is unchanged
  // and the paid runtime keeps counting down from where it was (no timer reset). We only swap the
  // launch command (model + vLLM flags) and the container env (userData). No re-payment: the service
  // is already paid for its window, so escrow is untouched (the payment summary is hidden in edit
  // mode for the same reason). Contrast with a fresh launch below, which mints a new service.
  const relaunchService = useCallback(async () => {
    // A single model is selected (the flow is capped at one); its committed params come from context.
    const model = selectedModels[0];
    const params = model ? modelParamsByModel[model.id] : undefined;
    if (!model || !params || !selectedEnv || !account.address || !targetServiceId) {
      const missing = [
        !model && 'model',
        model && !params && 'model parameters',
        !selectedEnv && 'environment',
        !account.address && 'wallet',
        !targetServiceId && 'service id',
      ].filter(Boolean);
      setLaunchError(`Selection incomplete — missing: ${missing.join(', ')}.`);
      return;
    }

    setLaunching(true);
    setLaunchError(null);
    try {
      const nodeUri = toNodeUri(selectedEnv.nodeInfo);
      const [job] = await withNodeAuth(selectedEnv.nodeInfo.id, nodeUri, (token) =>
        serviceRestart(nodeUri, token, targetServiceId, buildUserData(params, hfToken), buildVllmCommand(model, params))
      );
      if (!job?.serviceId) {
        throw new Error('Node did not return a service id.');
      }
      router.push({
        pathname: `/inference/services/${encodeURIComponent(job.serviceId)}`,
        query: buildManageQuery(),
      });
    } catch (error) {
      console.error('Failed to relaunch inference service:', error);
      setLaunchError(error instanceof Error ? error.message : 'Failed to relaunch service.');
    } finally {
      setLaunching(false);
    }
  }, [
    selectedModels,
    modelParamsByModel,
    selectedEnv,
    account.address,
    targetServiceId,
    withNodeAuth,
    hfToken,
    serviceRestart,
    router,
    buildManageQuery,
  ]);

  // Launch the service for real: single model on a vLLM instance. Escrow is prepared client-side
  // first (bundled deposit+authorize when funds/authorization are missing); the node then locks and
  // claims the cost server-side. Auth is a JWT node token (same as the run-job auth-token flow);
  // serviceStart returns a job in `Starting` state and the manage page polls it to `Running` to
  // read the real endpoint.
  const goToNextStep = useCallback(async () => {
    if (isProlongMode) {
      await prolongService();
      return;
    }
    // Edit → restart the existing service in place (keeps port + elapsed time); never a fresh start.
    if (isEditMode) {
      await relaunchService();
      return;
    }
    // A single model is selected (the flow is capped at one); its committed params come from context.
    const model = selectedModels[0];
    const params = model ? modelParamsByModel[model.id] : undefined;
    if (!model || !params || !selectedEnv || !selectedToken || !account.address) {
      // Name the missing piece so an edit-mode relaunch (which inherits env/token from the running
      // service via URL hydration) surfaces which part didn't restore, instead of a generic message.
      const missing = [
        !model && 'model',
        model && !params && 'model parameters',
        !selectedEnv && 'environment',
        !selectedToken && 'payment token',
        !account.address && 'wallet',
      ].filter(Boolean);
      setLaunchError(`Selection incomplete — missing: ${missing.join(', ')}.`);
      return;
    }
    if (jobDurationSeconds <= 0) {
      setLaunchError('Pick a duration greater than zero.');
      return;
    }
    // The node sets expiresAt = now + duration and rejects a window past the env's max.
    // Mirror the prolong guard so a deep-linked/refreshed payment page with an
    // over-max duration fails here rather than after the (wasted) escrow deposit tx.
    const envMax = selectedEnv.environment.maxJobDuration;
    if (envMax && jobDurationSeconds > envMax) {
      setLaunchError(
        `The selected duration exceeds this environment's maximum session length (${formatDuration(envMax)}). Pick a shorter duration.`
      );
      return;
    }

    setLaunching(true);
    setLaunchError(null);
    try {
      // The node locks the service cost in escrow right after start — deposit/authorize first if
      // the current escrow state can't cover it (one bundled tx on smart accounts).
      await ensureEscrowForSelection();
      const nodeUri = toNodeUri(selectedEnv.nodeInfo);
      const startParams = buildInferenceStartParams({
        model,
        params,
        selectedEnv,
        allocation,
        durationSeconds: jobDurationSeconds,
        tokenAddress: selectedToken.address,
        hfToken,
      });
      const [job] = await withNodeAuth(selectedEnv.nodeInfo.id, nodeUri, (token) =>
        serviceStart(nodeUri, token, startParams)
      );
      if (!job?.serviceId) {
        throw new Error('Node did not return a service id.');
      }
      router.push({
        pathname: `/inference/services/${encodeURIComponent(job.serviceId)}`,
        query: buildManageQuery(),
      });
    } catch (error) {
      console.error('Failed to launch inference service:', error);
      setLaunchError(error instanceof Error ? error.message : 'Failed to launch service.');
    } finally {
      setLaunching(false);
    }
  }, [
    isProlongMode,
    prolongService,
    isEditMode,
    relaunchService,
    selectedModels,
    modelParamsByModel,
    selectedEnv,
    selectedToken,
    account.address,
    withNodeAuth,
    ensureEscrowForSelection,
    allocation,
    jobDurationSeconds,
    hfToken,
    serviceStart,
    router,
    buildManageQuery,
  ]);

  return (
    <Container className="pageRoot">
      <SectionTitle
        moreReadable
        title="Inference"
        subTitle={isProlongMode ? 'Prolong your running service' : 'Launch a model on an Ocean Node'}
        contentBetween={
          isProlongMode ? undefined : <InferenceStepper currentStep="payment" edit={isEditMode} flowType={flowType} />
        }
      />
      <div className="pageContentWrapper">
        {!hydrateFromUrlFinished ? (
          <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
            <div className="textSecondary">Loading selection…</div>
          </Card>
        ) : hydrationFailed ? (
          <InferenceHydrationError />
        ) : (
          <>
            <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
              {/* Payment summary — hidden in edit mode (same env, no re-pay) and while the wallet is
                  disconnected, where escrow/wallet balances read as 0 and would misrepresent the cost. */}
              {!isEditMode &&
                (!account.address ? (
                  <div className="textSecondary">Connect your wallet to see payment details.</div>
                ) : selectedEnv && selectedToken ? (
                  loadingPaymentInfo && escrowBalance === null && walletBalance === null ? (
                    <CircularProgress className="alignSelfCenter" />
                  ) : paymentInfoError ? (
                    <div className="textAccent1">{paymentInfoError}</div>
                  ) : (
                    <PaymentSummary
                      authorizations={authorizations}
                      escrowBalance={escrowBalance ?? 0}
                      loadPaymentInfo={loadPaymentInfo}
                      selectedToken={selectedToken}
                      totalCost={totalCost}
                      walletBalance={walletBalance ?? 0}
                    />
                  )
                ) : (
                  <div className="textSecondary">Select an environment first.</div>
                ))}

              {/* Models */}
              {models.length > 0 && (
                <>
                  <div className={styles.sectionHead}>
                    <h3>Models</h3>
                    <span className="textSecondary">Expand for launch parameters</span>
                  </div>
                  <InferenceModelList models={models} />
                </>
              )}
              {/* Environment */}
              {selectedEnv && (
                <>
                  <div className={styles.sectionHead}>
                    <h3>Environment</h3>
                    <span className="textSecondary">
                      {isProlongMode ? 'Adding ' : 'Running for '}
                      {formatDuration(jobDurationSeconds)}
                    </span>
                  </div>
                  <InferenceEnvironmentCard
                    defaultToken={selectedToken?.address}
                    durationSeconds={jobDurationSeconds}
                    environment={selectedEnv.environment}
                    gpuSelection={selectedEnv.gpuSelection}
                    nodeInfo={selectedEnv.nodeInfo}
                  />
                </>
              )}
              {launchError && <div className="textAccent1">{launchError}</div>}
            </Card>
            <InferenceNavigation
              hideSelection
              // Launch/extend/restart all need the wallet (auth token signature + escrow tx). When it
              // isn't connected, prompt the login modal instead of stranding the user on a dead button;
              // once connected, gate only on the P2P layer being ready.
              nextDisabled={account.address ? !isReady : false}
              nextLabel={
                !account.address
                  ? 'Connect wallet'
                  : isProlongMode
                    ? 'Pay & prolong'
                    : isEditMode
                      ? 'Relaunch'
                      : 'Pay & launch'
              }
              nextLoading={launching}
              onNext={account.address ? goToNextStep : login}
              onPrev={goToPrevStep}
            />
          </>
        )}
      </div>
    </Container>
  );
};

export default PaymentPage;
