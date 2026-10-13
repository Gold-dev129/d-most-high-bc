import express from 'express';
import { uploadImages, deleteImage } from '../controllers/uploadController.js';
import { protect } from '../middleware/authMiddleware.js';
import { adminOnly } from '../middleware/adminMiddleware.js';
import { uploadMultipleImages } from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.post('/images', protect, adminOnly, uploadMultipleImages, uploadImages);
router.delete('/images/:publicId', protect, adminOnly, deleteImage);
router.delete('/images', protect, adminOnly, deleteImage);

export default router;
