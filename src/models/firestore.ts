import { initializeApp, getApps, type App } from 'firebase-admin/app';
import { getFirestore, FieldValue, type Firestore } from 'firebase-admin/firestore';
import { config } from '../config.js';
import type { ExperimentPhase, ExperimentStatus } from './types.js';

const COLLECTION = 'experiments';

function getApp(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  // Emulator mode: no credentials needed
  if (config.FIRESTORE_EMULATOR_HOST) {
    process.env.FIRESTORE_EMULATOR_HOST = config.FIRESTORE_EMULATOR_HOST;
    return initializeApp({ projectId: config.FIRESTORE_PROJECT_ID ?? 'geo-benchmark-dev' });
  }

  // Production: use default credentials or service account
  if (config.FIRESTORE_PROJECT_ID) {
    return initializeApp({ projectId: config.FIRESTORE_PROJECT_ID });
  }

  return initializeApp();
}

let _db: Firestore | null = null;

function getDb(): Firestore {
  if (!_db) {
    _db = getFirestore(getApp());
  }
  return _db;
}

export async function createExperimentStatus(
  experimentId: string,
  totalRuns: number,
): Promise<void> {
  const status: ExperimentStatus = {
    experimentId,
    totalRuns,
    completedRuns: 0,
    failedRuns: 0,
    currentPhase: 'fetching',
    updatedAt: new Date(),
  };

  await getDb().collection(COLLECTION).doc(experimentId).set(status);
}

export async function updateExperimentStatus(
  experimentId: string,
  update: Partial<Omit<ExperimentStatus, 'experimentId'>>,
): Promise<void> {
  await getDb()
    .collection(COLLECTION)
    .doc(experimentId)
    .update({
      ...update,
      updatedAt: new Date(),
    });
}

export async function incrementCompletedRuns(experimentId: string): Promise<void> {
  await getDb()
    .collection(COLLECTION)
    .doc(experimentId)
    .update({
      completedRuns: FieldValue.increment(1),
      updatedAt: new Date(),
    });
}

export async function incrementFailedRuns(experimentId: string): Promise<void> {
  await getDb()
    .collection(COLLECTION)
    .doc(experimentId)
    .update({
      failedRuns: FieldValue.increment(1),
      updatedAt: new Date(),
    });
}

export async function setPhase(experimentId: string, phase: ExperimentPhase): Promise<void> {
  await getDb().collection(COLLECTION).doc(experimentId).update({
    currentPhase: phase,
    updatedAt: new Date(),
  });
}

export async function getExperimentStatus(experimentId: string): Promise<ExperimentStatus | null> {
  const doc = await getDb().collection(COLLECTION).doc(experimentId).get();

  if (!doc.exists) {
    return null;
  }

  return doc.data() as ExperimentStatus;
}
