const express = require('express');
const router = express.Router();
const {
  processPayrollBatch,
  getPayrollBatches,
  getPayrollBatchById,
  lockPayrollBatch,
  reviewPayrollBatch,
  publishPayrollBatch,
  rollbackPayrollBatch
} = require('../controllers/payrollController');
const { authenticate } = require('../middleware/auth');

// Status dispatcher middleware helper
const updateBatchStatusHandler = async (req, res, next) => {
  const { status } = req.body || {};
  if (status === 'LOCKED') return lockPayrollBatch(req, res, next);
  if (status === 'REVIEW') return reviewPayrollBatch(req, res, next);
  if (status === 'PUBLISHED') return publishPayrollBatch(req, res, next);
  if (status === 'ROLLED_BACK') return rollbackPayrollBatch(req, res, next);
  return lockPayrollBatch(req, res, next);
};

// 1. Process Batch Endpoints
router.post('/process', authenticate, processPayrollBatch);
router.post('/batches/process', authenticate, processPayrollBatch);
router.post('/batch/process', authenticate, processPayrollBatch);

// 2. Fetch Batches & Batch Details
router.get('/batches', authenticate, getPayrollBatches);
router.get('/batch', authenticate, getPayrollBatches);
router.get('/batches/:id', authenticate, getPayrollBatchById);
router.get('/batch/:id', authenticate, getPayrollBatchById);

// 3. Generic Status Update
router.put('/batches/:id/status', authenticate, updateBatchStatusHandler);
router.put('/batch/:id/status', authenticate, updateBatchStatusHandler);

// 4. Specific Action Routes (support both PUT and POST, singular and plural)
router.put('/batch/:id/lock', authenticate, lockPayrollBatch);
router.post('/batch/:id/lock', authenticate, lockPayrollBatch);
router.put('/batches/:id/lock', authenticate, lockPayrollBatch);
router.post('/batches/:id/lock', authenticate, lockPayrollBatch);

router.put('/batch/:id/review', authenticate, reviewPayrollBatch);
router.post('/batch/:id/review', authenticate, reviewPayrollBatch);
router.put('/batches/:id/review', authenticate, reviewPayrollBatch);
router.post('/batches/:id/review', authenticate, reviewPayrollBatch);

router.put('/batch/:id/publish', authenticate, publishPayrollBatch);
router.post('/batch/:id/publish', authenticate, publishPayrollBatch);
router.put('/batches/:id/publish', authenticate, publishPayrollBatch);
router.post('/batches/:id/publish', authenticate, publishPayrollBatch);

router.put('/batch/:id/rollback', authenticate, rollbackPayrollBatch);
router.post('/batch/:id/rollback', authenticate, rollbackPayrollBatch);
router.put('/batches/:id/rollback', authenticate, rollbackPayrollBatch);
router.post('/batches/:id/rollback', authenticate, rollbackPayrollBatch);

module.exports = router;
