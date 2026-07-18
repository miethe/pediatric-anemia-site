import { deriveFacts as deriveFactsForModule } from './facts/registry.js';

export function deriveFacts(input) {
  return deriveFactsForModule(input, 'anemia');
}
