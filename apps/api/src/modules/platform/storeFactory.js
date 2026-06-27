import { createMemoryStore } from './memoryStore.js';
import { createPersistentStore } from './persistentStore.js';

export function createStore(config) {
  if (String(config.storeProvider).toLowerCase() === 'mongo') {
    return createPersistentStore({ config });
  }

  return createMemoryStore();
}
