import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import { sendSuccess, sendError, sendPaginated } from '../utils/apiResponse.js';
import { generateOrderNumber } from '../utils/orderNumber.js';
import {
  DEFAULT_SHIPPING_FEE,
  DEFAULT_PAGE_LIMIT,
  USER_ROLES,
  DELIVERY_FEES,
  SERVICE_FEE,
} from '../config/constants.js';
import { initializePaystackTransaction, isPaystackConfigured } from '../config/paystack.js';
import { memoryStore } from '../utils/fallbackData.js';

/**
 * @desc    Create a new order & optionally initialize payment
 * @route   POST /api/orders/checkout
 * @access  Public / Optional Auth (Guest or Logged in)
 */
export const checkout = async (req, res, next) => {
  try {
    const { items, customer, callback_url } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return sendError(res, 'Checkout requires at least one product item.', 400);
    }

    if (!customer || !customer.name || !customer.email || !customer.phone || !customer.address || !customer.city || !customer.state) {
      return sendError(res, 'Complete customer details (name, email, phone, address, city, state) are required.', 400);
    }

    // Step 1: Validate items & calculate authoritative pricing from database
    const orderItems = [];
    let subtotal = 0;
    let regularPriceSum = 0;

    for (const item of items) {
      if (!item.productId || !item.quantity || item.quantity <= 0) {
        return sendError(res, 'Each item must have a valid productId and quantity >= 1.', 400);
      }

      const product =
        mongoose.connection.readyState === 1
          ? await Product.findById(item.productId)
          : memoryStore.products.find(
              (p) => String(p._id) === String(item.productId) || p.slug === item.productId
            );
      if (!product || !product.active) {
        return sendError(
          res,
          `Product "${product ? product.name : item.productId}" is currently unavailable.`,
          400
        );
      }

      // Stock check
      if (product.stock < item.quantity) {
        return sendError(
          res,
          `Insufficient stock for "${product.name}". Available: ${product.stock}, requested: ${item.quantity}.`,
          400
        );
      }

      // Determine authoritative price (never trust frontend)
      const unitPrice =
        product.discountPrice !== null &&
        product.discountPrice !== undefined &&
        product.discountPrice > 0
          ? product.discountPrice
          : product.price;

      const lineTotal = unitPrice * item.quantity;
      subtotal += lineTotal;
      regularPriceSum += product.price * item.quantity;

      // Color-specific product image selection
      let productImage = '';
      if (product.images && product.images.length > 0) {
        const itemColorLower = (item.color || '').trim().toLowerCase();
        const matchedImg = product.images.find(
          (img) => img.color && img.color.trim().toLowerCase() === itemColorLower
        );
        productImage = matchedImg ? matchedImg.url : product.images[0].url;
      }

      orderItems.push({
        product: product._id,
        productName: product.name,
        productImage,
        size: item.size || 'Standard',
        color: item.color || 'Standard',
        quantity: item.quantity,
        price: unitPrice,
        subtotal: lineTotal,
      });
    }

    // Step 2: Delivery fee by city, service fee & authoritative total calculation
    const cityKey = (customer.city || '').trim().toLowerCase();
    let shippingFee = DEFAULT_SHIPPING_FEE;
    if (cityKey === 'ibadan') {
      shippingFee = DELIVERY_FEES.ibadan; // 6,000
    } else if (cityKey === 'lagos') {
      shippingFee = DELIVERY_FEES.lagos; // 7,000
    } else if (cityKey === 'abuja') {
      shippingFee = DELIVERY_FEES.abuja; // 8,500
    } else if (DELIVERY_FEES[cityKey]) {
      shippingFee = DELIVERY_FEES[cityKey];
    }

    const serviceFee = SERVICE_FEE; // 1,000
    const discount = Math.max(0, regularPriceSum - subtotal);
    const total = subtotal + serviceFee + shippingFee;

    // Step 3: Generate order number & order document
    const orderNumber = generateOrderNumber();

    const paymentMethod = customer.paymentMethod || 'whatsapp_transfer';

    const order = new Order({
      orderNumber,
      user: req.user ? req.user._id : null,
      customerName: customer.name.trim(),
      customerEmail: customer.email.trim().toLowerCase(),
      customerPhone: customer.phone.trim(),
      shippingAddress: {
        address: customer.address.trim(),
        city: customer.city.trim(),
        state: customer.state.trim(),
        country: customer.country ? customer.country.trim() : 'Nigeria',
      },
      items: orderItems,
      subtotal,
      discount,
      shippingFee,
      serviceFee,
      total,
      paymentMethod,
      paymentStatus: 'pending',
      orderStatus: 'pending',
      paymentReference: orderNumber,
    });

    if (mongoose.connection.readyState === 1) {
      await order.save();
    } else {
      memoryStore.orders.unshift({
        ...order.toObject(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    // Step 4: Handle WhatsApp or Paystack payment
    let paymentData = null;
    let paymentMessage = 'Order created successfully.';

    if (paymentMethod === 'whatsapp_transfer') {
      paymentMessage = 'Order created successfully. Awaiting WhatsApp bank transfer receipt verification.';
    } else {
      const frontendBase = process.env.FRONTEND_URL || 'http://localhost:5173';
      const effectiveCallbackUrl =
        callback_url || `${frontendBase}/order-confirmed?reference=${order.orderNumber}`;

      if (isPaystackConfigured()) {
        try {
          paymentData = await initializePaystackTransaction({
            email: order.customerEmail,
            amount: Math.round(order.total * 100), // convert NGN to Kobo
            reference: order.orderNumber,
            callback_url: effectiveCallbackUrl,
            metadata: {
              orderId: order._id.toString(),
              orderNumber: order.orderNumber,
              customerPhone: order.customerPhone,
            },
          });
        } catch (payError) {
          console.error('Paystack initialization error:', payError.message);
          paymentMessage = `Order created, but payment initialization failed: ${payError.message}`;
        }
      } else {
        paymentMessage = 'Order created. Paystack credentials not yet configured; proceeding with direct bank transfer.';
      }
    }

    return sendSuccess(
      res,
      paymentMessage,
      {
        order,
        payment: paymentData,
      },
      201
    );
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get authenticated customer's orders
 * @route   GET /api/orders/my-orders
 * @access  Private (Customer)
 */
export const getMyOrders = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_PAGE_LIMIT));
    const skip = (page - 1) * limit;

    if (mongoose.connection.readyState !== 1) {
      const userEmail = (req.user?.email || '').toLowerCase();
      const userId = String(req.user?._id || '');
      const userOrders = memoryStore.orders.filter(
        (o) =>
          o.customerEmail?.toLowerCase() === userEmail ||
          String(o.user) === userId
      );
      return sendPaginated(res, 'Order history retrieved successfully.', userOrders, {
        total: userOrders.length,
        page: 1,
        pages: 1,
        limit,
      });
    }

    const query = {
      $or: [
        { user: req.user._id },
        { customerEmail: req.user.email.toLowerCase() },
      ],
    };

    const total = await Order.countDocuments(query);
    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return sendPaginated(res, 'Order history retrieved successfully.', orders, {
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
      limit,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get order details by ID
 * @route   GET /api/orders/:id
 * @access  Private / Public with reference lookup
 */
export const getOrderById = async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const order = memoryStore.orders.find(
        (o) => String(o._id) === req.params.id || o.orderNumber === req.params.id
      );
      if (!order) {
        return sendError(res, 'Order not found.', 404);
      }
      return sendSuccess(res, 'Order details retrieved successfully.', { order });
    }

    const order = await Order.findById(req.params.id).populate('items.product', 'name slug images');
    if (!order) {
      return sendError(res, 'Order not found.', 404);
    }

    // Security check: only order owner or admin can view order
    const isOwner =
      req.user &&
      ((order.user && order.user.toString() === req.user._id.toString()) ||
        order.customerEmail.toLowerCase() === req.user.email.toLowerCase());

    const isAdmin = req.user && req.user.role === USER_ROLES.ADMIN;

    if (!isOwner && !isAdmin) {
      return sendError(res, 'Access denied. You do not have permission to view this order.', 403);
    }

    return sendSuccess(res, 'Order details retrieved successfully.', { order });
  } catch (error) {
    next(error);
  }
};
