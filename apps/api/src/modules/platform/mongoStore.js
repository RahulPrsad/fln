import { MongoClient } from 'mongodb';

export async function createMongoClient(config) {
  const client = new MongoClient(config.mongoUri, {
    appName: config.serviceName
  });
  await client.connect();
  return client;
}

export function getMongoDatabase(client, dbName = 'smartfln') {
  return client.db(dbName);
}
