import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary with environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export const isCloudinaryConfigured = () => {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET &&
    !process.env.CLOUDINARY_CLOUD_NAME.includes('your_')
  );
};

/**
 * Upload a file buffer directly to Cloudinary using upload_stream
 * @param {Buffer} buffer - File buffer from multer memory storage
 * @param {Object} options - Cloudinary upload options (folder, etc.)
 * @returns {Promise<{ public_id: string, url: string }>}
 */
export const uploadBufferToCloudinary = (buffer, options = {}) => {
  return new Promise((resolve, reject) => {
    if (!isCloudinaryConfigured()) {
      return reject(new Error('Cloudinary credentials are not configured in .env file.'));
    }

    const uploadOptions = {
      folder: 'dmosthigh/products',
      resource_type: 'image',
      ...options,
    };

    const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, result) => {
      if (error) {
        return reject(error);
      }
      resolve({
        public_id: result.public_id,
        url: result.secure_url,
      });
    });

    stream.end(buffer);
  });
};

/**
 * Delete an image from Cloudinary by public ID
 * @param {string} publicId
 * @returns {Promise<Object>}
 */
export const deleteFromCloudinary = async (publicId) => {
  if (!isCloudinaryConfigured()) {
    console.warn('Skipping Cloudinary deletion: credentials not configured.');
    return { result: 'skipped' };
  }
  return cloudinary.uploader.destroy(publicId);
};

export default cloudinary;
