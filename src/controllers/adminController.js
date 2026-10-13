import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import { sendSuccess, sendError, sendPaginated } from '../utils/apiResponse.js';
import { ORDER_STATUS, PAYMENT_STATUS, USER_ROLES, DEFAULT_PAGE_LIMIT } from '../config/constants.js';
import { memoryStore } from '../utils/fallbackData.js';

/**
 * @desc    Get admin dashboard aggregated statistics
 * @route   GET /api/admin/dashboard
 * @access  Admin only
 */
export const getDashboardStats = async (req, res, next) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      const totalOrders = memoryStore.orders.length;
      const pendingOrders = memoryStore.orders.filter((o) => o.orderStatus === ORDER_STATUS.PENDING).length;
      const paidOrders = memoryStore.orders.filter((o) => o.orderStatus === ORDER_STATUS.PAID).length;
      const processingOrders = memoryStore.orders.filter((o) => o.orderStatus === ORDER_STATUS.PROCESSING).length;
      const shippedOrders = memoryStore.orders.filter((o) => o.orderStatus === ORDER_STATUS.SHIPPED).length;
      const deliveredOrders = memoryStore.orders.filter((o) => o.orderStatus === ORDER_STATUS.DELIVERED).length;
      const cancelledOrders = memoryStore.orders.filter((o) => o.orderStatus === ORDER_STATUS.CANCELLED).length;
      const totalCustomers = memoryStore.users.length;
      const totalProducts = memoryStore.products.length;
      const totalRevenue = memoryStore.orders
        .filter((o) => o.paymentStatus === PAYMENT_STATUS.PAID)
        .reduce((sum, o) => sum + (o.total || 0), 0);
      const recentOrders = memoryStore.orders.slice(0, 5);

      return sendSuccess(res, 'Dashboard statistics retrieved successfully.', {
        totalOrders,
        pendingOrders,
        paidOrders,
        processingOrders,
        shippedOrders,
        deliveredOrders,
        cancelledOrders,
        totalCustomers,
        totalProducts,
        totalRevenue,
        recentOrders,
      });
    }

    const [
      totalOrders,
      pendingOrders,
      paidOrders,
      processingOrders,
      shippedOrders,
      deliveredOrders,
      cancelledOrders,
      totalCustomers,
      totalProducts,
      revenueAggregation,
      recentOrders,
    ] = await Promise.all([
      Order.countDocuments(),
      Order.countDocuments({ orderStatus: ORDER_STATUS.PENDING }),
      Order.countDocuments({ orderStatus: ORDER_STATUS.PAID }),
      Order.countDocuments({ orderStatus: ORDER_STATUS.PROCESSING }),
      Order.countDocuments({ orderStatus: ORDER_STATUS.SHIPPED }),
      Order.countDocuments({ orderStatus: ORDER_STATUS.DELIVERED }),
      Order.countDocuments({ orderStatus: ORDER_STATUS.CANCELLED }),
      User.countDocuments({ role: USER_ROLES.CUSTOMER }),
      Product.countDocuments(),
      Order.aggregate([
        { $match: { paymentStatus: PAYMENT_STATUS.PAID } },
        { $group: { _id: null, totalRevenue: { $sum: '$total' } } },
      ]),
      Order.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select('orderNumber customerName customerEmail total orderStatus paymentStatus createdAt'),
    ]);

    const totalRevenue = revenueAggregation.length > 0 ? revenueAggregation[0].totalRevenue : 0;

    return sendSuccess(res, 'Dashboard statistics retrieved successfully.', {
      totalOrders,
      pendingOrders,
      paidOrders,
      processingOrders,
      shippedOrders,
      deliveredOrders,
      cancelledOrders,
      totalCustomers,
      totalProducts,
      totalRevenue,
      recentOrders,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all orders with filtering, search, and pagination
 * @route   GET /api/admin/orders
 * @access  Admin only
 */
export const getAllOrders = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_PAGE_LIMIT));
    const skip = (page - 1) * limit;

    if (mongoose.connection.readyState !== 1) {
      let filtered = [...memoryStore.orders];
      if (req.query.status) {
        filtered = filtered.filter((o) => (o.orderStatus || '').toLowerCase() === req.query.status.toLowerCase());
      }
      if (req.query.paymentStatus) {
        filtered = filtered.filter((o) => (o.paymentStatus || '').toLowerCase() === req.query.paymentStatus.toLowerCase());
      }
      if (req.query.search) {
        const s = req.query.search.trim().toLowerCase();
        filtered = filtered.filter(
          (o) =>
            (o.orderNumber || '').toLowerCase().includes(s) ||
            (o.customerName || '').toLowerCase().includes(s) ||
            (o.customerEmail || '').toLowerCase().includes(s) ||
            (o.customerPhone || '').toLowerCase().includes(s)
        );
      }
      const total = filtered.length;
      const paginated = filtered.slice(skip, skip + limit);
      return sendPaginated(res, 'Orders retrieved successfully.', paginated, {
        total,
        page,
        pages: Math.ceil(total / limit) || 1,
        limit,
      });
    }

    const query = {};

    // Filter by order status
    if (req.query.status) {
      query.orderStatus = req.query.status.toLowerCase();
    }

    // Filter by payment status
    if (req.query.paymentStatus) {
      query.paymentStatus = req.query.paymentStatus.toLowerCase();
    }

    // Search query (orderNumber, customerEmail, customerName)
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search.trim(), 'i');
      query.$or = [
        { orderNumber: searchRegex },
        { customerName: searchRegex },
        { customerEmail: searchRegex },
        { customerPhone: searchRegex },
      ];
    }

    const total = await Order.countDocuments(query);
    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'name email phone');

    return sendPaginated(res, 'Orders retrieved successfully.', orders, {
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
 * @desc    Get single order details for admin
 * @route   GET /api/admin/orders/:id
 * @access  Admin only
 */
export const getAdminOrderById = async (req, res, next) => {
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

    const order = await Order.findById(req.params.id)
      .populate('user', 'name email phone address')
      .populate('items.product', 'name slug images category');

    if (!order) {
      return sendError(res, 'Order not found.', 404);
    }

    return sendSuccess(res, 'Order details retrieved successfully.', { order });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update order status
 * @route   PATCH /api/admin/orders/:id/status
 * @access  Admin only
 */
export const updateOrderStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    if (!status || !Object.values(ORDER_STATUS).includes(status.toLowerCase())) {
      return sendError(
        res,
        `Invalid status. Allowed statuses: ${Object.values(ORDER_STATUS).join(', ')}`,
        400
      );
    }

    const normalizedStatus = status.toLowerCase();

    if (mongoose.connection.readyState !== 1) {
      const order = memoryStore.orders.find(
        (o) => String(o._id) === req.params.id || o.orderNumber === req.params.id
      );
      if (!order) {
        return sendError(res, 'Order not found.', 404);
      }
      order.orderStatus = normalizedStatus;
      if (normalizedStatus === ORDER_STATUS.DELIVERED) {
        order.deliveredAt = new Date().toISOString();
      }
      if (normalizedStatus === ORDER_STATUS.PAID && order.paymentStatus !== PAYMENT_STATUS.PAID) {
        order.paymentStatus = PAYMENT_STATUS.PAID;
        order.paidAt = new Date().toISOString();
      }
      return sendSuccess(res, `Order status updated to "${normalizedStatus}".`, {
        order,
      });
    }

    const order = await Order.findById(req.params.id);

    if (!order) {
      return sendError(res, 'Order not found.', 404);
    }

    order.orderStatus = normalizedStatus;

    if (normalizedStatus === ORDER_STATUS.DELIVERED) {
      order.deliveredAt = new Date();
    }

    // If order was marked paid by admin, record payment status
    if (normalizedStatus === ORDER_STATUS.PAID && order.paymentStatus !== PAYMENT_STATUS.PAID) {
      order.paymentStatus = PAYMENT_STATUS.PAID;
      order.paidAt = new Date();
    }

    const updatedOrder = await order.save();

    return sendSuccess(res, `Order status updated to "${normalizedStatus}".`, {
      order: updatedOrder,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all customers with order statistics
 * @route   GET /api/admin/customers
 * @access  Admin only
 */
export const getAllCustomers = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_PAGE_LIMIT));
    const skip = (page - 1) * limit;

    if (mongoose.connection.readyState !== 1) {
      let customers = memoryStore.users.filter((u) => u.role === USER_ROLES.CUSTOMER);
      if (req.query.search) {
        const s = req.query.search.trim().toLowerCase();
        customers = customers.filter(
          (c) =>
            (c.name || '').toLowerCase().includes(s) ||
            (c.email || '').toLowerCase().includes(s) ||
            (c.phone || '').toLowerCase().includes(s)
        );
      }
      const customersWithOrderCount = customers.map((customer) => {
        const orderCount = memoryStore.orders.filter(
          (o) => String(o.user) === String(customer._id) || (o.customerEmail || '').toLowerCase() === customer.email.toLowerCase()
        ).length;
        const { password, ...custData } = customer;
        return {
          ...custData,
          orderCount,
        };
      });
      const total = customersWithOrderCount.length;
      const paginated = customersWithOrderCount.slice(skip, skip + limit);
      return sendPaginated(res, 'Customers retrieved successfully.', paginated, {
        total,
        page,
        pages: Math.ceil(total / limit) || 1,
        limit,
      });
    }

    const query = { role: USER_ROLES.CUSTOMER };

    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search.trim(), 'i');
      query.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
      ];
    }

    const total = await User.countDocuments(query);
    const customers = await User.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Retrieve order counts for each customer
    const customersWithOrderCount = await Promise.all(
      customers.map(async (customer) => {
        const orderCount = await Order.countDocuments({
          $or: [{ user: customer._id }, { customerEmail: customer.email }],
        });
        return {
          ...customer.toJSON(),
          orderCount,
        };
      })
    );

    return sendPaginated(res, 'Customers retrieved successfully.', customersWithOrderCount, {
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
 * @desc    Get all products for admin management (including inactive)
 * @route   GET /api/admin/products
 * @access  Admin only
 */
export const getAdminProducts = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || DEFAULT_PAGE_LIMIT));
    const skip = (page - 1) * limit;

    if (mongoose.connection.readyState !== 1) {
      let filtered = [...memoryStore.products];
      if (req.query.category) {
        filtered = filtered.filter(
          (p) => p.category.toLowerCase() === req.query.category.toLowerCase().trim()
        );
      }
      if (req.query.search) {
        const s = req.query.search.trim().toLowerCase();
        filtered = filtered.filter(
          (p) =>
            (p.name || '').toLowerCase().includes(s) ||
            (p.description || '').toLowerCase().includes(s) ||
            (p.category || '').toLowerCase().includes(s)
        );
      }
      if (req.query.active !== undefined) {
        const isActive = req.query.active === 'true';
        filtered = filtered.filter((p) => p.active === isActive);
      }
      const total = filtered.length;
      const paginated = filtered.slice(skip, skip + limit);
      return sendPaginated(res, 'Admin product list retrieved successfully.', paginated, {
        total,
        page,
        pages: Math.ceil(total / limit) || 1,
        limit,
      });
    }

    const query = {};

    if (req.query.category) {
      query.category = req.query.category.toLowerCase().trim();
    }

    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search.trim(), 'i');
      query.$or = [
        { name: searchRegex },
        { description: searchRegex },
        { category: searchRegex },
      ];
    }

    if (req.query.active !== undefined) {
      query.active = req.query.active === 'true';
    }

    const total = await Product.countDocuments(query);
    const products = await Product.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return sendPaginated(res, 'Admin product list retrieved successfully.', products, {
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
      limit,
    });
  } catch (error) {
    next(error);
  }
};
