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

export async function ensureMongoIndexes(database) {
  await Promise.all([
    database.collection('tenants').createIndex({ id: 1 }, { unique: true }),
    database.collection('schools').createIndex({ tenantId: 1, code: 1 }, { unique: true }),
    database.collection('academicYears').createIndex({ tenantId: 1, name: 1 }, { unique: true }),
    database
      .collection('classSections')
      .createIndex({ tenantId: 1, schoolId: 1, academicYearId: 1, gradeLevel: 1, sectionName: 1 }, { unique: true }),
    database.collection('students').createIndex({ tenantId: 1, schoolId: 1, externalStudentId: 1 }),
    database.collection('students').createIndex({ tenantId: 1, schoolId: 1, admissionNumber: 1 }),
    database.collection('enrollments').createIndex({ tenantId: 1, classSectionId: 1, status: 1 }),
    database.collection('sessions').createIndex({ userId: 1, status: 1 }),
    database.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    database.collection('auditEvents').createIndex({ tenantId: 1, createdAt: -1 }),
    database.collection('assessments').createIndex({ tenantId: 1, classSectionId: 1, status: 1 }),
    database.collection('paperPages').createIndex({ tenantId: 1, paperInstanceId: 1, pageNumber: 1 }),
    database.collection('scanPages').createIndex({ tenantId: 1, scanBatchId: 1, status: 1 }),
    database.collection('reviewTasks').createIndex({ tenantId: 1, status: 1, priority: 1 }),
    database.collection('studentResults').createIndex({ tenantId: 1, assessmentId: 1, studentId: 1 }, { unique: true }),
    database.collection('exportJobs').createIndex({ tenantId: 1, createdAt: -1 }),
    database.collection('exportJobs').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    database.collection('appState').createIndex({ type: 1, updatedAt: -1 })
  ]);
}
