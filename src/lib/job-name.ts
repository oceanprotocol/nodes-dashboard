import { adjectives, animals, uniqueNamesGenerator } from 'unique-names-generator';

// Auto-generates a friendly "adjective-animal" job name. Identical config to the
// ocean-orchestrator's generateJobName (helpers/jobNames.ts) so both surfaces draw
// from the same name space.
export function generateJobName(): string {
  return uniqueNamesGenerator({
    dictionaries: [adjectives, animals],
    separator: '-',
    length: 2,
  });
}
