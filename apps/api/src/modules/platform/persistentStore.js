import { createMemoryStore } from './memoryStore.js';
import { createSeedData } from './seedData.js';
import { createMongoClient, ensureMongoIndexes, getMongoDatabase } from './mongoStore.js';

const stateCollectionName = 'appState';
const platformStateId = 'platform:v1';
const workflowStateId = 'workflow:v1';

const mutatingPrefixes = [
  'append',
  'archive',
  'assign',
  'close',
  'consume',
  'create',
  'remove',
  'revoke',
  'update',
  'withdraw'
];

function now() {
  return new Date().toISOString();
}

function isMutatingMethod(name) {
  return mutatingPrefixes.some((prefix) => name.startsWith(prefix));
}

export function createPersistentStore({ config, seed = createSeedData() }) {
  let memoryStore = createMemoryStore(seed);
  let databasePromise = null;
  let loadPromise = null;
  let isLoaded = false;
  let saveQueue = Promise.resolve();

  async function getDatabase() {
    if (!databasePromise) {
      databasePromise = (async () => {
        const client = await createMongoClient(config);
        const database = getMongoDatabase(client, config.mongoDbName);
        await ensureMongoIndexes(database);
        return database;
      })();
    }
    return databasePromise;
  }

  async function readState(documentId) {
    const database = await getDatabase();
    const document = await database.collection(stateCollectionName).findOne({ _id: documentId });
    return document?.state ?? null;
  }

  async function writeState(documentId, state, type) {
    const database = await getDatabase();
    await database.collection(stateCollectionName).updateOne(
      { _id: documentId },
      {
        $set: {
          state,
          type,
          schemaVersion: 1,
          updatedAt: now()
        },
        $setOnInsert: {
          createdAt: now()
        }
      },
      { upsert: true }
    );
  }

  async function ensureLoaded() {
    if (isLoaded) {
      return;
    }

    if (!loadPromise) {
      loadPromise = (async () => {
        const persistedState = await readState(platformStateId);
        if (persistedState) {
          memoryStore = createMemoryStore(persistedState);
        } else {
          await writeState(platformStateId, memoryStore.exportState(), 'platform');
        }
        isLoaded = true;
      })().catch((error) => {
        loadPromise = null;
        throw error;
      });
    }

    await loadPromise;
  }

  function enqueueWrite(documentId, state, type) {
    saveQueue = saveQueue.catch(() => undefined).then(() => writeState(documentId, state, type));
    return saveQueue;
  }

  async function savePlatformState() {
    await enqueueWrite(platformStateId, memoryStore.exportState(), 'platform');
  }

  return new Proxy(
    {},
    {
      get(_target, property) {
        if (typeof property !== 'string') {
          return memoryStore[property];
        }

        if (property === 'provider') {
          return 'mongo';
        }

        if (property === 'healthCheck') {
          return async () => {
            const database = await getDatabase();
            await database.command({ ping: 1 });
            return { provider: 'mongo', database: config.mongoDbName, status: 'ok' };
          };
        }

        if (property === 'getWorkflowState') {
          return async () => readState(workflowStateId);
        }

        if (property === 'saveWorkflowState') {
          return async (state) => enqueueWrite(workflowStateId, state, 'workflow');
        }

        if (property === 'exportState') {
          return async () => {
            await ensureLoaded();
            return memoryStore.exportState();
          };
        }

        const value = memoryStore[property];
        if (typeof value !== 'function') {
          return value;
        }

        return async (...args) => {
          await ensureLoaded();
          const result = await memoryStore[property](...args);
          if (isMutatingMethod(property)) {
            await savePlatformState();
          }
          return result;
        };
      }
    }
  );
}
