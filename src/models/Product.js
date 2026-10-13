import mongoose from 'mongoose';
import { slugify } from '../utils/slugify.js';

const imageSchema = new mongoose.Schema(
  {
    public_id: { type: String, required: true },
    url: { type: String, required: true },
    color: { type: String, default: '' },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      maxlength: [150, 'Product name cannot exceed 150 characters'],
    },
    slug: {
      type: String,
      unique: true,
      index: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Product description is required'],
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Product category is required'],
      trim: true,
      lowercase: true,
      index: true,
    },
    price: {
      type: Number,
      required: [true, 'Product price is required'],
      min: [0, 'Price cannot be negative'],
    },
    discountPrice: {
      type: Number,
      default: null,
      validate: {
        validator: function (value) {
          if (value === null || value === undefined || value === 0) return true;
          return value < this.price;
        },
        message: 'Discount price must be strictly less than the regular price',
      },
    },
    discountPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    images: {
      type: [imageSchema],
      validate: {
        validator: function (val) {
          return Array.isArray(val);
        },
        message: 'Images must be an array',
      },
      default: [],
    },
    sizes: {
      type: [String],
      default: ['S', 'M', 'L', 'XL'],
    },
    colors: {
      type: [String],
      default: ['Black'],
    },
    stock: {
      type: Number,
      required: [true, 'Stock count is required'],
      min: [0, 'Stock cannot be negative'],
      default: 0,
    },
    featured: {
      type: Boolean,
      default: false,
      index: true,
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Auto-generate slug and calculate discount percentage pre-validate
productSchema.pre('validate', function (next) {
  if (this.isModified('name') || !this.slug) {
    const baseSlug = slugify(this.name);
    // Add short random string suffix to ensure uniqueness
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    this.slug = `${baseSlug}-${randomSuffix}`;
  }

  // Calculate discount percentage
  if (this.discountPrice && this.discountPrice > 0 && this.discountPrice < this.price) {
    this.discountPercentage = Math.round(
      ((this.price - this.discountPrice) / this.price) * 100
    );
  } else {
    this.discountPrice = null;
    this.discountPercentage = 0;
  }

  next();
});

// Full-text search index on name, description, and category
productSchema.index({ name: 'text', description: 'text', category: 'text' });

const Product = mongoose.model('Product', productSchema);
export default Product;
