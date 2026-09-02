import { fetchHuggingFaceModel } from '@/services/huggingface-service';
import { HuggingFaceModel } from '@/types/huggingface';
import { InferencePackage } from '@/types/inference';
import { useEffect, useState } from 'react';

/**
 * Full HF model for a picked package. Returns the package's stub immediately (card/modal render with
 * no wait), then fetches by id and swaps in the complete model — so Continue/Customize commits full
 * data. On failure keeps the stub (payment page re-hydrates by id anyway).
 */
const usePackageModel = (pkg: InferencePackage | null): HuggingFaceModel | null => {
  const [model, setModel] = useState<HuggingFaceModel | null>(pkg?.model ?? null);

  useEffect(() => {
    if (!pkg) {
      setModel(null);
      return;
    }
    let cancelled = false;
    setModel(pkg.model);
    fetchHuggingFaceModel(pkg.model.id)
      .then((full) => {
        if (!cancelled) {
          setModel(full);
        }
      })
      .catch((error) => {
        console.error(`Failed to enrich package model "${pkg.model.id}":`, error);
      });
    return () => {
      cancelled = true;
    };
  }, [pkg]);

  return model;
};

export default usePackageModel;
