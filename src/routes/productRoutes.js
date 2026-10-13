import express from 'express';
import { body, param } from 'express-validator';
import {
  getProducts,
  getProductById,
  getProductBySlug,
  createProduct,
  updateProduct,
  deleteProduct,
  updateProductStatus,
  updateProductStock,
  updateProductDiscount,
} from '../controllers/productController.js';
import { protect, optionalAuth } from '../middleware/authMiddleware.js';
import { adminOnly } from '../middleware/adminMiddleware.js';
import { validate } from '../middleware/validatorMiddleware.js';

const router = express.Router();

// Product creation validation rules
const productValidation = [
  body('name').trim().notEmpty().withMessage('Product name is required'),
  body('description').trim().notEmpty().withMessage('Product description is required'),
  body('category').trim().notEmpty().withMessage('Product category is required'),
  body('price')
    .isFloat({ min: 0 })
    .withMessage('Valid non-negative price is required'),
  body('stock')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Stock must be an integer >= 0'),
];

// Public / Client Routes
router.get('/', optionalAuth, getProducts);
router.get('/slug/:slug', optionalAuth, getProductBySlug);
router.get('/:id', optionalAuth, getProductById);

// Admin-Protected Routes
router.post('/', protect, adminOnly, productValidation, validate, createProduct);
router.put('/:id', protect, adminOnly, updateProduct);
router.delete('/:id', protect, adminOnly, deleteProduct);
router.patch('/:id/status', protect, adminOnly, updateProductStatus);
router.patch('/:id/stock', protect, adminOnly, updateProductStock);
router.patch('/:id/discount', protect, adminOnly, updateProductDiscount);

export default router;
