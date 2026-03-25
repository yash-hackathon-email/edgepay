// ─── Transaction Engine ──────────────────────────────────────────────
// Core transaction processing: create, execute via USSD, and track transactions

import type { Transaction, TransactionStatus, NetworkMode, SmsMessage } from '../types';
import { generateTransactionId } from '../utils/formatters';
import { buildUssdCommand } from './USSDBuilder';
import { sendUssdRequest, dialUssdCode } from './USSDService';
import { onSmsReceived, readRecentSms } from './SmsService';
import { parseSmsForTransaction, isBankSms, parseDemoSms } from './SmsParser';

// Increased timeout: banks can take 15-30 seconds to send confirmation SMS
const SMS_WAIT_TIMEOUT_MS = 120000; // 120 seconds as requested
const SMS_POLL_INTERVAL_MS = 3000; // Poll inbox every 3 seconds

/**
 * Validate transaction inputs before processing
 */
export function validateTransaction(
  amount: number,
  receiver: string,
  maxAmount: number
): { valid: boolean; error?: string } {
  if (!receiver || receiver.trim().length < 3) {
    return { valid: false, error: 'Please enter a valid receiver' };
  }
  if (amount <= 0) {
    return { valid: false, error: 'Amount must be greater than zero' };
  }
  if (amount > maxAmount) {
    return { valid: false, error: `Limit exceeded` };
  }
  return { valid: true };
}

/**
 * Create a new transaction object
 */
export function createTransaction(
  amount: number,
  receiver: string,
  receiverName?: string,
  mode: NetworkMode = 'GSM'
): Transaction {
  const ussdCommand = buildUssdCommand(receiver.trim(), amount);
  return {
    id: generateTransactionId(),
    amount,
    receiver: receiver.trim(),
    receiverName: receiverName?.trim(),
    method: 'USSD',
    status: 'PENDING',
    timestamp: Date.now(),
    retryCount: 0,
    ussdCommand,
  };
}

/**
 * Execute a transaction via USSD — then confirm via SMS
 * Two-phase confirmation:
 * 1. Real-time SMS listener (catches bank SMS as they arrive)
 * 2. Polling inbox fallback (reads recent SMS every 5s to catch messages
 *    that arrived while the system USSD menu was active)
 */
export async function executeUssdTransaction(
  transaction: Transaction,
  onStatusUpdate: (id: string, status: TransactionStatus, message?: string) => void
): Promise<Transaction> {
  const ussdCommand = buildUssdCommand(transaction.receiver, transaction.amount);
  const updatedTxn = { ...transaction, ussdCommand, status: 'SENT' as TransactionStatus };
  const txnStartTime = Date.now();

  try {
    onStatusUpdate(transaction.id, 'SENT', 'Dialing...');

    try {
      // Try direct USSD request first (modern Android)
      const result = await sendUssdRequest(ussdCommand);
      if (result.status === 'SUCCESS') {
        onStatusUpdate(transaction.id, 'PENDING', 'Waiting for Bank Confirmation...');
      }
    } catch (ussdError: any) {
      // Fallback to dialer (standard Android)
      onStatusUpdate(transaction.id, 'SENT', 'Initiating dialer...');
      await dialUssdCode(ussdCommand);
    }

    // Phase: Wait for bank confirmation via SMS
    onStatusUpdate(transaction.id, 'PENDING', 'Awaiting SMS Confirmation...');

    const smsResult = await waitForBankConfirmation(transaction, txnStartTime);
    if (smsResult === 'SUCCESS') {
      onStatusUpdate(transaction.id, 'SUCCESS', 'Payment Completed!');
      return { ...updatedTxn, status: 'SUCCESS' };
    }

    onStatusUpdate(transaction.id, 'FAILED', 'No confirmation received.');
    return { ...updatedTxn, status: 'FAILED' };
  } catch (error: any) {
    onStatusUpdate(transaction.id, 'FAILED', 'Transaction failed.');
    return { ...updatedTxn, status: 'FAILED' };
  }
}

/**
 * Wait for bank confirmation using BOTH real-time listener AND inbox polling.
 * This solves the issue where the bank sends a debit SMS while the USSD
 * system menu is active — the BroadcastReceiver may miss it, but reading
 * the inbox directly will always find it.
 */
function waitForBankConfirmation(
  transaction: Transaction,
  txnStartTime: number
): Promise<'SUCCESS' | 'FAILED'> {
  return new Promise((resolve) => {
    let resolved = false;

    const finish = (result: 'SUCCESS' | 'FAILED') => {
      if (resolved) return;
      resolved = true;
      subscription.remove();
      if (pollTimer) clearInterval(pollTimer);
      if (timeoutTimer) clearTimeout(timeoutTimer);
      resolve(result);
    };

    // Method 1: Real-time SMS listener
    const subscription = onSmsReceived((sms: SmsMessage) => {
      if (isBankSms(sms.sender)) {
        const result = parseSmsForTransaction(sms);
        if (result === 'SUCCESS') {
          finish('SUCCESS');
          return;
        }
      }
      const demoResult = parseDemoSms(sms.body);
      if (demoResult.result === 'SUCCESS') {
        finish('SUCCESS');
      }
    });

    // Method 2: Poll SMS inbox every 5 seconds
    const pollTimer = setInterval(async () => {
      try {
        const recentMessages = await readRecentSms(15);
        for (const sms of recentMessages) {
          // Only check messages that arrived AFTER the transaction started
          if (sms.timestamp >= txnStartTime - 5000) {
            if (isBankSms(sms.sender)) {
              const result = parseSmsForTransaction(sms);
              if (result === 'SUCCESS') {
                finish('SUCCESS');
                return;
              }
            }
            const demoResult = parseDemoSms(sms.body);
            if (demoResult.result === 'SUCCESS') {
              finish('SUCCESS');
              return;
            }
          }
        }
      } catch (err) {
        // Silently continue polling
      }
    }, SMS_POLL_INTERVAL_MS);

    // Timeout: auto-fail after 45 seconds
    const timeoutTimer = setTimeout(() => {
      finish('FAILED');
    }, SMS_WAIT_TIMEOUT_MS);
  });
}
