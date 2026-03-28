// ─── Queue System ────────────────────────────────────────────────────
// Manages pending transactions, retries, and persistent queue storage

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Transaction } from '../types';
import { STORAGE_KEYS, MAX_RETRY_COUNT, RETRY_DELAY_MS } from '../utils/constants';

/**
 * Load pending queue from persistent storage
 */
export async function loadQueue(): Promise<Transaction[]> {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_QUEUE);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('[QueueSystem] Failed to load queue:', error);
    return [];
  }
}

/**
 * Save pending queue to persistent storage
 */
export async function saveQueue(queue: Transaction[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEYS.PENDING_QUEUE, JSON.stringify(queue));
  } catch (error) {
    console.error('[QueueSystem] Failed to save queue:', error);
  }
}

/**
 * Add a transaction to the retry queue
 */
export async function enqueue(transaction: Transaction): Promise<Transaction[]> {
  const queue = await loadQueue();
  const queuedTxn: Transaction = {
    ...transaction,
    status: 'QUEUED',
  };
  const updatedQueue = [...queue, queuedTxn];
  await saveQueue(updatedQueue);
  return updatedQueue;
}

/**
 * Remove a transaction from the queue
 */
export async function dequeue(transactionId: string): Promise<Transaction[]> {
  const queue = await loadQueue();
  const updatedQueue = queue.filter(txn => txn.id !== transactionId);
  await saveQueue(updatedQueue);
  return updatedQueue;
}

/**
 * Get transactions eligible for retry
 */
export function getRetryableTransactions(queue: Transaction[]): Transaction[] {
  const now = Date.now();
  return queue.filter(txn => {
    // Only retry if under max retry count
    if (txn.retryCount >= MAX_RETRY_COUNT) return false;

    // Only retry if enough time has passed since last attempt
    if (txn.lastRetryAt && (now - txn.lastRetryAt) < RETRY_DELAY_MS) return false;

    // Only retry QUEUED or FAILED transactions
    if (txn.status !== 'QUEUED' && txn.status !== 'FAILED') return false;

    return true;
  });
}

/**
 * Update a transaction in the queue (e.g., increment retry count)
 */
export async function updateQueuedTransaction(
  transactionId: string,
  updates: Partial<Transaction>
): Promise<Transaction[]> {
  const queue = await loadQueue();
  const updatedQueue = queue.map(txn =>
    txn.id === transactionId
      ? { ...txn, ...updates, lastRetryAt: Date.now() }
      : txn
  );
  await saveQueue(updatedQueue);
  return updatedQueue;
}

/**
 * Process the retry queue — attempt to resend failed transactions
 */
export async function processQueue(
  executeFn: (txn: Transaction) => Promise<Transaction>
): Promise<{ processed: number; succeeded: number; failed: number }> {
  const queue = await loadQueue();
  const retryable = getRetryableTransactions(queue);

  let succeeded = 0;
  let failed = 0;

  for (const txn of retryable) {
    try {
      const retryTxn = {
        ...txn,
        retryCount: txn.retryCount + 1,
        lastRetryAt: Date.now(),
      };

      const result = await executeFn(retryTxn);

      if (result.status === 'SUCCESS') {
        await dequeue(txn.id);
        succeeded++;
      } else {
        await updateQueuedTransaction(txn.id, {
          retryCount: retryTxn.retryCount,
          status: retryTxn.retryCount >= MAX_RETRY_COUNT ? 'FAILED' : 'QUEUED',
        });
        failed++;
      }
    } catch (error) {
      console.error(`[QueueSystem] Retry failed for ${txn.id}:`, error);
      await updateQueuedTransaction(txn.id, {
        retryCount: txn.retryCount + 1,
      });
      failed++;
    }
  }

  return { processed: retryable.length, succeeded, failed };
}

/**
 * Clear all items from the queue
 */
export async function clearQueue(): Promise<void> {
  await saveQueue([]);
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<{
  total: number;
  retryable: number;
  maxedOut: number;
}> {
  const queue = await loadQueue();
  const retryable = getRetryableTransactions(queue);
  const maxedOut = queue.filter(txn => txn.retryCount >= MAX_RETRY_COUNT);

  return {
    total: queue.length,
    retryable: retryable.length,
    maxedOut: maxedOut.length,
  };
}
