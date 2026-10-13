import express from 'express';
import {
  getDashboardStats,
  getAllOrders,
  getAdminOrderById,
  updateOrderStatus,
  getAllCustomers,
  getAdminProducts,
} from '../controllers/adminController.js';
import { protect } from '../middleware/authMiddleware.js';
import { adminOnly } from '../middleware/adminMiddleware.js';

const router = express.Router();

// Apply auth and admin check to all routes in this router
router.use(protect, adminOnly);

router.get('/dashboard', getDashboardStats);
router.get('/orders', getAllOrders);
router.get('/orders/:id', getAdminOrderById);
router.patch('/orders/:id/status', updateOrderStatus);
router.get('/customers', getAllCustomers);
router.get('/products', getAdminProducts);

export default router;
