import express from 'express';
import { body } from 'express-validator';
import {
  checkout,
  getMyOrders,
  getOrderById,
} from '../controllers/orderController.js';
import { protect, optionalAuth } from '../middleware/authMiddleware.js';
import { checkoutLimiter } from '../middleware/rateLimiter.js';
import { validate } from '../middleware/validatorMiddleware.js';

const router = express.Router();

// Validation for checkout
const checkoutValidation = [
  body('items')
    .isArray({ min: 1 })
    .withMessage('At least one item is required for checkout'),
  body('items.*.productId')
    .notEmpty()
    .withMessage('Each item must contain a productId'),
  body('items.*.quantity')
    .isInt({ min: 1 })
    .withMessage('Item quantity must be at least 1'),
  body('customer.name').trim().notEmpty().withMessage('Customer name is required'),
  body('customer.email').isEmail().withMessage('Valid customer email is required'),
  body('customer.phone').trim().notEmpty().withMessage('Customer phone is required'),
  body('customer.address').trim().notEmpty().withMessage('Customer address is required'),
  body('customer.city').trim().notEmpty().withMessage('Customer city is required'),
  body('customer.state').trim().notEmpty().withMessage('Customer state is required'),
];

router.post('/checkout', optionalAuth, checkoutLimiter, checkoutValidation, validate, checkout);
router.get('/my-orders', protect, getMyOrders);
router.get('/:id', protect, getOrderById);

export default router;
