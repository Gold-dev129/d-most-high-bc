import {
  uploadBufferToCloudinary,
  deleteFromCloudinary,
  isCloudinaryConfigured,
} from '../config/cloudinary.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

/**
 * @desc    Upload one or multiple images to Cloudinary
 * @route   POST /api/upload/images
 * @access  Admin only
 */
export const uploadImages = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return sendError(res, 'Please provide at least one image file under the "images" field.', 400);
    }

    if (!isCloudinaryConfigured()) {
      if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
        const devImages = req.files.map((file, idx) => ({
          public_id: `dev_upload_${Date.now()}_${idx}`,
          url: `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
        }));
        return sendSuccess(res, 'Images uploaded in development mode (base64 fallback).', {
          images: devImages,
        }, 201);
      }
      return sendError(
        res,
        'Cloudinary credentials are not configured in the server .env file. Please configure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.',
        503
      );
    }

    const uploadPromises = req.files.map((file) =>
      uploadBufferToCloudinary(file.buffer, {
        folder: 'dmosthigh/products',
      })
    );

    const uploadedResults = await Promise.all(uploadPromises);

    return sendSuccess(res, 'Images uploaded successfully to Cloudinary.', {
      images: uploadedResults,
    }, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete an image from Cloudinary by public ID
 * @route   DELETE /api/upload/images/:publicId
 * @access  Admin only
 */
export const deleteImage = async (req, res, next) => {
  try {
    // Parameter might be passed as route param or body
    const publicId = req.params.publicId || req.body.publicId;

    if (!publicId) {
      return sendError(res, 'Image publicId is required for deletion.', 400);
    }

    if (!isCloudinaryConfigured()) {
      return sendError(
        res,
        'Cloudinary credentials are not configured in the server .env file.',
        503
      );
    }

    const result = await deleteFromCloudinary(publicId);

    return sendSuccess(res, 'Image deleted from Cloudinary successfully.', { result });
  } catch (error) {
    next(error);
  }
};
