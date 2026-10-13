import express from 'express';
import {
  initializePayment,
  verifyPayment,
  handleWebhook,
} from '../controllers/paymentController.js';
import { checkoutLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

router.post('/initialize', checkoutLimiter, initializePayment);
router.get('/verify/:reference', verifyPayment);
router.post('/webhook', handleWebhook);

export default router;
