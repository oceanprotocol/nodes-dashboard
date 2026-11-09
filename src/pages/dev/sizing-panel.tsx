import Card from '@/components/card/card';
import Container from '@/components/container/container';
import CustomModelSizingPanel, {
  ContextChoice,
  CustomModelSizingPanelHandle,
  FitSummary,
  NoFitCard,
  SizingLayout,
  SizingListHeader,
} from '@/components/inference/custom-model-sizing-panel';
import React, { useRef, useState } from 'react';

// Custom-model sizing panel, every state from mocked props: not linked from the app, reachable by URL.
// Qwen/Qwen3.8-27B figures (max context 262,144 tokens).

const CHOICES: ContextChoice[] = [
  { value: 'default', label: '256K', suffix: 'max' },
  { value: '8192', label: '8K' },
  { value: '32768', label: '32K' },
  { value: '131072', label: '128K' },
];

const LAYOUTS: Record<string, SizingLayout[]> = {
  default: [
    { gpus: 1, gbPerGpu: 88 },
    { gpus: 2, gbPerGpu: 58 },
    { gpus: 4, gbPerGpu: 42 },
    { gpus: 8, gbPerGpu: 34 },
  ],
  '131072': [
    { gpus: 1, gbPerGpu: 80 },
    { gpus: 2, gbPerGpu: 50 },
    { gpus: 4, gbPerGpu: 33 },
    { gpus: 8, gbPerGpu: 26 },
  ],
  '32768': [
    { gpus: 1, gbPerGpu: 72 },
    { gpus: 2, gbPerGpu: 41 },
    { gpus: 4, gbPerGpu: 25 },
    { gpus: 8, gbPerGpu: 18 },
  ],
  '8192': [
    { gpus: 1, gbPerGpu: 70 },
    { gpus: 2, gbPerGpu: 39 },
    { gpus: 4, gbPerGpu: 24 },
    { gpus: 8, gbPerGpu: 17 },
  ],
};

const WIDTHS = [1, 2, 4, 8];

function State({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card direction="column" padding="md" radius="lg" shadow="black" spacing="md" variant="glass-shaded">
      <h3>{title}</h3>
      {children}
    </Card>
  );
}

const SizingPanelPreview: React.FC = () => {
  const [value, setValue] = useState('default');
  const emptyRef = useRef<CustomModelSizingPanelHandle>(null);
  const label = CHOICES.find((c) => c.value === value)?.label ?? '256K';

  return (
    <Container className="pageRoot">
      <div className="flexColumn gapLg" style={{ paddingBlock: 32 }}>
        <State title="Default (interactive)">
          <CustomModelSizingPanel
            contextChoices={CHOICES}
            contextValue={value}
            layouts={LAYOUTS[value]}
            onContextChange={setValue}
            widths={WIDTHS}
          />
          <SizingListHeader context={label} count={2} />
          <FitSummary gpuCounts={[1, 2, 4]} />
        </State>

        <State title="Loading">
          <CustomModelSizingPanel
            contextChoices={[{ value: 'default', label: 'Max' }, ...CHOICES.slice(1)]}
            contextValue="default"
            layouts={null}
            loading
            onContextChange={() => {}}
            widths={null}
          />
        </State>

        <State title="No estimate">
          <CustomModelSizingPanel
            contextChoices={CHOICES}
            contextValue="default"
            gaps={{ noEstimate: true }}
            layouts={null}
            onContextChange={() => {}}
            widths={WIDTHS}
          />
        </State>

        <State title="Context unknown">
          <CustomModelSizingPanel
            contextChoices={[{ value: 'default', label: '4K', suffix: 'assumed' }]}
            contextUnknown
            contextValue="default"
            gaps={{ contextAssumed: true, configUnreadable: true }}
            layouts={[
              { gpus: 1, gbPerGpu: 62 },
              { gpus: 2, gbPerGpu: 34 },
            ]}
            onContextChange={() => {}}
            widths={null}
          />
        </State>

        <State title="Empty result">
          <CustomModelSizingPanel
            contextChoices={CHOICES}
            contextValue="default"
            highlightContext
            layouts={LAYOUTS.default}
            onContextChange={() => {}}
            ref={emptyRef}
            widths={WIDTHS}
          />
          <NoFitCard context="256K" onChooseShorter={() => emptyRef.current?.focusContext()} />
        </State>
      </div>
    </Container>
  );
};

export default SizingPanelPreview;
