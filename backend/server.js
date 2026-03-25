// ─── EdgePay Backend ─────────────────────────────────────────────────
// Purpose: Sync transactions, backup logs, analytics
// Uses file-based persistence for production reliability

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_DIR = path.join(__dirname, 'data');
const TXN_FILE = path.join(DATA_DIR, 'transactions.json');
const SYNC_LOG_FILE = path.join(DATA_DIR, 'sync_logs.json');

app.use(cors());
app.use(express.json());

// ─── Persistence Helpers ─────────────────────────────────────────────

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadJson(filePath, fallback = []) {
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error(`[Storage] Failed to load ${filePath}:`, err.message);
  }
  return fallback;
}

function saveJson(filePath, data) {
  try {
    ensureDataDir();
    // Atomic write: write to tmp file then rename
    const tmpFile = filePath + '.tmp';
    fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmpFile, filePath);
  } catch (err) {
    console.error(`[Storage] Failed to save ${filePath}:`, err.message);
  }
}

// Load data on startup
ensureDataDir();
let transactions = loadJson(TXN_FILE, []);
let syncLogs = loadJson(SYNC_LOG_FILE, []);

// ─── Routes ──────────────────────────────────────────────────────────

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'EdgePay Backend',
    timestamp: new Date().toISOString(),
    transactionCount: transactions.length,
    persistence: 'file-based',
  });
});

// Sync transactions from device
app.post('/api/transactions/sync', (req, res) => {
  const { deviceId, transactions: deviceTxns } = req.body;

  if (!deviceTxns || !Array.isArray(deviceTxns)) {
    return res.status(400).json({ error: 'Invalid transaction data' });
  }

  // Merge with existing (deduplicate by ID)
  const existingIds = new Set(transactions.map(t => t.id));
  const newTxns = deviceTxns.filter(t => !existingIds.has(t.id));
  transactions = [...transactions, ...newTxns];

  // Persist
  saveJson(TXN_FILE, transactions);

  const logEntry = {
    deviceId,
    syncedCount: newTxns.length,
    timestamp: new Date().toISOString(),
  };
  syncLogs.push(logEntry);
  saveJson(SYNC_LOG_FILE, syncLogs);

  res.json({
    status: 'synced',
    newTransactions: newTxns.length,
    totalTransactions: transactions.length,
  });
});

// Get all synced transactions
app.get('/api/transactions', (req, res) => {
  const { status, limit = 50, offset = 0 } = req.query;

  let filtered = transactions;
  if (status) {
    filtered = filtered.filter(t => t.status === status);
  }

  const paginated = filtered.slice(Number(offset), Number(offset) + Number(limit));

  res.json({
    transactions: paginated,
    total: filtered.length,
    limit: Number(limit),
    offset: Number(offset),
  });
});

// Get transaction by ID
app.get('/api/transactions/:id', (req, res) => {
  const txn = transactions.find(t => t.id === req.params.id);
  if (!txn) {
    return res.status(404).json({ error: 'Transaction not found' });
  }
  res.json(txn);
});

// Update transaction status
app.patch('/api/transactions/:id', (req, res) => {
  const idx = transactions.findIndex(t => t.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Transaction not found' });
  }
  transactions[idx] = { ...transactions[idx], ...req.body, updatedAt: new Date().toISOString() };
  saveJson(TXN_FILE, transactions);
  res.json(transactions[idx]);
});

// Analytics endpoint
app.get('/api/analytics', (req, res) => {
  const total = transactions.length;
  const success = transactions.filter(t => t.status === 'SUCCESS').length;
  const failed = transactions.filter(t => t.status === 'FAILED').length;
  const pending = transactions.filter(t => t.status === 'PENDING' || t.status === 'QUEUED').length;
  const totalAmount = transactions
    .filter(t => t.status === 'SUCCESS')
    .reduce((sum, t) => sum + (t.amount || 0), 0);
  const gsmCount = transactions.filter(t => t.method === 'GSM').length;

  res.json({
    totalTransactions: total,
    successRate: total > 0 ? ((success / total) * 100).toFixed(1) + '%' : '0%',
    breakdown: { success, failed, pending },
    totalAmountProcessed: totalAmount,
    gsmTransactions: gsmCount,
    onlineTransactions: total - gsmCount,
    syncLogs: syncLogs.slice(-10),
  });
});

// Get sync logs
app.get('/api/sync-logs', (req, res) => {
  res.json({ logs: syncLogs });
});

// ─── Start ───────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n⚡ EdgePay Backend running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health`);
  console.log(`   Analytics: http://localhost:${PORT}/api/analytics`);
  console.log(`   Transactions: http://localhost:${PORT}/api/transactions\n`);
});
