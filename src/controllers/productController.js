import mongoose from 'mongoose';
import Product from '../models/Product.js';
import { sendSuccess, sendError, sendPaginated } from '../utils/apiResponse.js';
import { DEFAULT_PAGE_LIMIT, USER_ROLES } from '../config/constants.js';
import { deleteFromCloudinary } from '../config/cloudinary.js';
import { memoryStore } from '../utils/fallbackData.js';

/**
 * @desc    Get all products with filtering, search, sorting & pagination
 * @route   GET /api/products
 * @access  Public
 */
export const getProducts = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_PAGE_LIMIT));
    const skip = (page - 1) * limit;

    // Resilient offline/Atlas fallback
    if (mongoose.connection.readyState !== 1) {
      let filtered = [...memoryStore.products];
      if (req.query.category) {
        filtered = filtered.filter((p) => p.category.toLowerCase() === req.query.category.toLowerCase().trim());
      }
      if (req.query.search) {
        const q = req.query.search.toLowerCase().trim();
        filtered = filtered.filter(
          (p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
        );
      }
      if (req.query.sort === 'price-low') {
        filtered.sort((a, b) => a.price - b.price);
      } else if (req.query.sort === 'price-high') {
        filtered.sort((a, b) => b.price - a.price);
      } else if (req.query.sort === 'name-asc') {
        filtered.sort((a, b) => a.name.localeCompare(b.name));
      }
      const total = filtered.length;
      const paginated = filtered.slice(skip, skip + limit);
      return sendPaginated(res, 'Products retrieved successfully.', paginated, {
        total,
        page,
        pages: Math.ceil(total / limit) || 1,
        limit,
      });
    }

    const query = {};

    // By default, public only sees active products
    // Admins can pass includeInactive=true to inspect hidden products
    const isAdmin = req.user && req.user.role === USER_ROLES.ADMIN;
    if (!isAdmin || req.query.includeInactive !== 'true') {
      query.active = true;
    }

    // Category filter
    if (req.query.category) {
      query.category = req.query.category.toLowerCase().trim();
    }

    // Featured filter
    if (req.query.featured !== undefined) {
      query.featured = req.query.featured === 'true';
    }

    // Price range filter
    if (req.query.minPrice !== undefined || req.query.maxPrice !== undefined) {
      query.price = {};
      if (req.query.minPrice !== undefined) {
        query.price.$gte = Number(req.query.minPrice);
      }
      if (req.query.maxPrice !== undefined) {
        query.price.$lte = Number(req.query.maxPrice);
      }
    }

    // Keyword search (regex matching name, description, or category)
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search.trim(), 'i');
      query.$or = [
        { name: searchRegex },
        { description: searchRegex },
        { category: searchRegex },
      ];
    }

    // Sorting
    let sortCriteria = { createdAt: -1 }; // default newest
    if (req.query.sort) {
      switch (req.query.sort) {
        case 'price-low':
          sortCriteria = { price: 1 };
          break;
        case 'price-high':
          sortCriteria = { price: -1 };
          break;
        case 'oldest':
          sortCriteria = { createdAt: 1 };
          break;
        case 'name-asc':
          sortCriteria = { name: 1 };
          break;
        case 'name-desc':
          sortCriteria = { name: -1 };
          break;
        default:
          sortCriteria = { createdAt: -1 };
      }
    }

    const total = await Product.countDocuments(query);
    const products = await Product.find(query)
      .sort(sortCriteria)
      .skip(skip)
      .limit(limit);

    return sendPaginated(
      res,
      'Products retrieved successfully.',
      products,
      {
        total,
        page,
        pages: Math.ceil(total / limit) || 1,
        limit,
      }
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single product by ID
 * @route   GET /api/products/:id
 * @access  Public
 */
export const getProductById = async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const product = memoryStore.products.find(
        (p) => p._id === req.params.id || p.slug === req.params.id
      );
      if (!product) return sendError(res, 'Product not found.', 404);
      return sendSuccess(res, 'Product retrieved successfully.', { product });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return sendError(res, 'Product not found.', 404);
    }

    // If product is inactive, only admin can view it
    const isAdmin = req.user && req.user.role === USER_ROLES.ADMIN;
    if (!product.active && !isAdmin) {
      return sendError(res, 'Product is currently unavailable.', 404);
    }

    return sendSuccess(res, 'Product retrieved successfully.', { product });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single product by Slug
 * @route   GET /api/products/slug/:slug
 * @access  Public
 */
export const getProductBySlug = async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const product = memoryStore.products.find((p) => p.slug === req.params.slug);
      if (!product) {
        return sendError(res, 'Product not found.', 404);
      }
      return sendSuccess(res, 'Product retrieved successfully.', { product });
    }

    const product = await Product.findOne({ slug: req.params.slug });
    if (!product) {
      return sendError(res, 'Product not found.', 404);
    }

    const isAdmin = req.user && req.user.role === USER_ROLES.ADMIN;
    if (!product.active && !isAdmin) {
      return sendError(res, 'Product is currently unavailable.', 404);
    }

    return sendSuccess(res, 'Product retrieved successfully.', { product });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create a new product
 * @route   POST /api/products
 * @access  Admin only
 */
export const createProduct = async (req, res, next) => {
  try {
    const {
      name,
      description,
      category,
      price,
      discountPrice,
      images,
      sizes,
      colors,
      stock,
      featured,
      active,
    } = req.body;

    // Validate discount logic
    if (discountPrice !== undefined && discountPrice !== null && discountPrice !== 0) {
      if (Number(discountPrice) >= Number(price)) {
        return sendError(
          res,
          'Discount price must be strictly less than the regular price.',
          400
        );
      }
    }

    if (mongoose.connection.readyState !== 1) {
      const slug = (name || 'product')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      const newProduct = {
        _id: 'prod_' + Date.now(),
        name,
        slug,
        description,
        category,
        price: Number(price),
        discountPrice: discountPrice ? Number(discountPrice) : null,
        images: Array.isArray(images) ? images : [],
        sizes: Array.isArray(sizes) && sizes.length ? sizes : ['S', 'M', 'L', 'XL'],
        colors: Array.isArray(colors) && colors.length ? colors : (Array.isArray(images) && images.length ? Array.from(new Set(images.map((i) => i.color).filter(Boolean))) : ['Standard']),
        stock: Number(stock) || 0,
        featured: Boolean(featured),
        active: active !== undefined ? Boolean(active) : true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      memoryStore.products.unshift(newProduct);
      return sendSuccess(res, 'Product created successfully.', { product: newProduct }, 201);
    }

    const product = new Product({
      name,
      description,
      category,
      price: Number(price),
      discountPrice: discountPrice ? Number(discountPrice) : null,
      images: Array.isArray(images) ? images : [],
      sizes: Array.isArray(sizes) && sizes.length ? sizes : ['S', 'M', 'L', 'XL'],
      colors: Array.isArray(colors) && colors.length ? colors : (Array.isArray(images) && images.length ? Array.from(new Set(images.map((i) => i.color).filter(Boolean))) : ['Standard']),
      stock: Number(stock) || 0,
      featured: Boolean(featured),
      active: active !== undefined ? Boolean(active) : true,
    });

    const savedProduct = await product.save();
    return sendSuccess(res, 'Product created successfully.', { product: savedProduct }, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update a product
 * @route   PUT /api/products/:id
 * @access  Admin only
 */
export const updateProduct = async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const product = memoryStore.products.find(
        (p) => String(p._id) === String(req.params.id) || p.slug === req.params.id
      );
      if (!product) {
        return sendError(res, 'Product not found.', 404);
      }
      const {
        name,
        description,
        category,
        price,
        discountPrice,
        images,
        sizes,
        colors,
        stock,
        featured,
        active,
      } = req.body;
      if (name) product.name = name;
      if (description) product.description = description;
      if (category) product.category = category;
      if (price !== undefined) product.price = Number(price);
      if (discountPrice !== undefined) product.discountPrice = discountPrice ? Number(discountPrice) : null;
      if (Array.isArray(images)) product.images = images;
      if (Array.isArray(sizes)) product.sizes = sizes;
      if (Array.isArray(colors)) product.colors = colors;
      if (stock !== undefined) product.stock = Number(stock);
      if (featured !== undefined) product.featured = Boolean(featured);
      if (active !== undefined) product.active = Boolean(active);
      product.updatedAt = new Date().toISOString();
      return sendSuccess(res, 'Product updated successfully.', { product });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return sendError(res, 'Product not found.', 404);
    }

    const {
      name,
      description,
      category,
      price,
      discountPrice,
      images,
      sizes,
      colors,
      stock,
      featured,
      active,
    } = req.body;

    const newPrice = price !== undefined ? Number(price) : product.price;
    let newDiscountPrice = discountPrice !== undefined ? discountPrice : product.discountPrice;

    if (newDiscountPrice !== null && newDiscountPrice !== undefined && Number(newDiscountPrice) > 0) {
      if (Number(newDiscountPrice) >= newPrice) {
        return sendError(
          res,
          'Discount price must be strictly less than the regular price.',
          400
        );
      }
    } else {
      newDiscountPrice = null;
    }

    if (name) product.name = name;
    if (description) product.description = description;
    if (category) product.category = category;
    product.price = newPrice;
    product.discountPrice = newDiscountPrice;

    if (Array.isArray(images)) product.images = images;
    if (Array.isArray(sizes)) product.sizes = sizes;
    if (Array.isArray(colors)) product.colors = colors;
    if (stock !== undefined) product.stock = Number(stock);
    if (featured !== undefined) product.featured = Boolean(featured);
    if (active !== undefined) product.active = Boolean(active);

    const updatedProduct = await product.save();
    return sendSuccess(res, 'Product updated successfully.', { product: updatedProduct });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete a product
 * @route   DELETE /api/products/:id
 * @access  Admin only
 */
export const deleteProduct = async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const index = memoryStore.products.findIndex(
        (p) => String(p._id) === String(req.params.id) || p.slug === req.params.id
      );
      if (index === -1) {
        return sendError(res, 'Product not found.', 404);
      }
      memoryStore.products.splice(index, 1);
      return sendSuccess(res, 'Product deleted successfully.');
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return sendError(res, 'Product not found.', 404);
    }

    // Best-effort cleanup of Cloudinary images
    if (product.images && product.images.length > 0) {
      for (const img of product.images) {
        if (img.public_id) {
          try {
            await deleteFromCloudinary(img.public_id);
          } catch (err) {
            console.error(`Failed to delete Cloudinary image ${img.public_id}:`, err.message);
          }
        }
      }
    }

    await Product.findByIdAndDelete(req.params.id);
    return sendSuccess(res, 'Product deleted successfully.');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Toggle product active status
 * @route   PATCH /api/products/:id/status
 * @access  Admin only
 */
export const updateProductStatus = async (req, res, next) => {
  try {
    const { active } = req.body;
    if (active === undefined) {
      return sendError(res, 'Active status (boolean) is required.', 400);
    }

    if (mongoose.connection.readyState !== 1) {
      const product = memoryStore.products.find(
        (p) => String(p._id) === String(req.params.id) || p.slug === req.params.id
      );
      if (!product) {
        return sendError(res, 'Product not found.', 404);
      }
      product.active = Boolean(active);
      return sendSuccess(res, `Product ${product.active ? 'activated' : 'deactivated'} successfully.`, {
        product,
      });
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { active: Boolean(active) },
      { new: true, runValidators: true }
    );

    if (!product) {
      return sendError(res, 'Product not found.', 404);
    }

    return sendSuccess(res, `Product ${product.active ? 'activated' : 'deactivated'} successfully.`, {
      product,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update product inventory stock
 * @route   PATCH /api/products/:id/stock
 * @access  Admin only
 */
export const updateProductStock = async (req, res, next) => {
  try {
    const { stock } = req.body;
    if (stock === undefined || Number(stock) < 0) {
      return sendError(res, 'Valid non-negative stock number is required.', 400);
    }

    if (mongoose.connection.readyState !== 1) {
      const product = memoryStore.products.find(
        (p) => String(p._id) === String(req.params.id) || p.slug === req.params.id
      );
      if (!product) {
        return sendError(res, 'Product not found.', 404);
      }
      product.stock = Number(stock);
      return sendSuccess(res, 'Product stock updated successfully.', { product });
    }

    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { stock: Number(stock) },
      { new: true, runValidators: true }
    );

    if (!product) {
      return sendError(res, 'Product not found.', 404);
    }

    return sendSuccess(res, 'Product stock updated successfully.', { product });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Set or remove product discount
 * @route   PATCH /api/products/:id/discount
 * @access  Admin only
 */
export const updateProductDiscount = async (req, res, next) => {
  try {
    const { discountPrice } = req.body;

    if (mongoose.connection.readyState !== 1) {
      const product = memoryStore.products.find(
        (p) => String(p._id) === String(req.params.id) || p.slug === req.params.id
      );
      if (!product) {
        return sendError(res, 'Product not found.', 404);
      }
      if (discountPrice === null || discountPrice === 0 || discountPrice === undefined) {
        product.discountPrice = null;
        product.discountPercentage = 0;
      } else {
        const numDiscount = Number(discountPrice);
        if (numDiscount >= product.price) {
          return sendError(
            res,
            'Discount price must be strictly less than the regular price.',
            400
          );
        }
        product.discountPrice = numDiscount;
      }
      return sendSuccess(res, 'Product discount updated successfully.', { product });
    }

    const product = await Product.findById(req.params.id);

    if (!product) {
      return sendError(res, 'Product not found.', 404);
    }

    if (discountPrice === null || discountPrice === 0 || discountPrice === undefined) {
      product.discountPrice = null;
      product.discountPercentage = 0;
    } else {
      const numDiscount = Number(discountPrice);
      if (numDiscount >= product.price) {
        return sendError(
          res,
          'Discount price must be strictly less than the regular price.',
          400
        );
      }
      product.discountPrice = numDiscount;
    }

    const updatedProduct = await product.save();
    return sendSuccess(res, 'Product discount updated successfully.', { product: updatedProduct });
  } catch (error) {
    next(error);
  }
};
