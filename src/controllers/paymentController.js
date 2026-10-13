import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import {
  initializePaystackTransaction,
  verifyPaystackTransaction,
  verifyPaystackSignature,
  isPaystackConfigured,
} from '../config/paystack.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { ORDER_STATUS, PAYMENT_STATUS } from '../config/constants.js';
import { memoryStore } from '../utils/fallbackData.js';

/**
 * Atomically deduct stock for items in an order
 * @param {Array} items
 */
const deductProductStock = async (items) => {
  for (const item of items) {
    if (item.product && item.quantity) {
      if (mongoose.connection.readyState === 1) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { stock: -item.quantity },
        });
      } else {
        const prod = memoryStore.products.find((p) => String(p._id) === String(item.product));
        if (prod) prod.stock = Math.max(0, (prod.stock || 0) - item.quantity);
      }
    }
  }
};

/**
 * @desc    Initialize a payment for an existing order
 * @route   POST /api/payment/initialize
 * @access  Public / Protected
 */
export const initializePayment = async (req, res, next) => {
  try {
    const { orderId, orderNumber, callback_url } = req.body;

    if (!orderId && !orderNumber) {
      return sendError(res, 'Either orderId or orderNumber must be provided.', 400);
    }

    const order =
      mongoose.connection.readyState === 1
        ? await Order.findOne({
            $or: [{ _id: orderId }, { orderNumber }],
          })
        : memoryStore.orders.find(
            (o) => String(o._id) === String(orderId) || o.orderNumber === orderNumber
          );

    if (!order) {
      return sendError(res, 'Order not found.', 404);
    }

    if (order.paymentStatus === PAYMENT_STATUS.PAID) {
      return sendError(res, 'This order has already been paid for.', 400);
    }

    if (!isPaystackConfigured() || mongoose.connection.readyState !== 1) {
      if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
        const frontendBase = process.env.FRONTEND_URL || 'http://localhost:5173';
        const simulatedUrl =
          callback_url || `${frontendBase}/order-confirmed?reference=${order.orderNumber}`;
        order.paymentReference = order.orderNumber;
        if (typeof order.save === 'function') await order.save();
        return sendSuccess(res, 'Paystack in test/dev mode. Simulated payment initialized.', {
          authorization_url: simulatedUrl,
          access_code: 'DEV_CODE_' + order.orderNumber,
          reference: order.orderNumber,
        });
      }
      return sendError(
        res,
        'Paystack credentials are not configured in the server .env file.',
        503
      );
    }

    // Call Paystack
    const paystackData = await initializePaystackTransaction({
      email: order.customerEmail,
      amount: Math.round(order.total * 100), // Amount in Kobo
      reference: order.orderNumber,
      callback_url: callback_url || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/order/confirmation/${order.orderNumber}`,
      metadata: {
        orderId: order._id.toString(),
        orderNumber: order.orderNumber,
      },
    });

    order.paymentReference = paystackData.reference;
    await order.save();

    return sendSuccess(res, 'Payment initialized successfully.', paystackData);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Verify Paystack transaction by reference
 * @route   GET /api/payment/verify/:reference
 * @access  Public
 */
export const verifyPayment = async (req, res, next) => {
  try {
    const { reference } = req.params;

    if (!reference) {
      return sendError(res, 'Payment reference is required.', 400);
    }

    // Locate the matching order
    const order =
      mongoose.connection.readyState === 1
        ? await Order.findOne({
            $or: [{ paymentReference: reference }, { orderNumber: reference }],
          })
        : memoryStore.orders.find(
            (o) => o.paymentReference === reference || o.orderNumber === reference
          );

    if (!order) {
      return sendError(res, 'Order associated with this payment reference was not found.', 404);
    }

    // Idempotent: If already marked as paid, return immediately
    if (order.paymentStatus === PAYMENT_STATUS.PAID) {
      return sendSuccess(res, 'Payment already verified and recorded.', {
        order,
        verified: true,
      });
    }

    if (!isPaystackConfigured() || mongoose.connection.readyState !== 1) {
      if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV || mongoose.connection.readyState !== 1) {
        order.paymentStatus = PAYMENT_STATUS.PAID;
        order.orderStatus = ORDER_STATUS.PROCESSING;
        order.transactionId = 'DEV-TX-' + Date.now();
        order.paidAt = new Date();
        if (typeof order.save === 'function') await order.save();
        await deductProductStock(order.items);
        return sendSuccess(
          res,
          'Development mode test payment verified successfully. Order confirmed.',
          {
            order,
            verified: true,
          }
        );
      }
      return sendError(
        res,
        'Paystack credentials are not configured in the server .env file.',
        503
      );
    }

    // Call Paystack Verification API
    const paystackData = await verifyPaystackTransaction(reference);

    if (paystackData.status !== 'success') {
      order.paymentStatus = PAYMENT_STATUS.FAILED;
      if (typeof order.save === 'function') await order.save();
      return sendError(
        res,
        `Payment was not successful. Paystack status: ${paystackData.status}`,
        400
      );
    }

    // Verify amount matches authoritative order total in Kobo
    const expectedAmountInKobo = Math.round(order.total * 100);
    if (paystackData.amount !== expectedAmountInKobo) {
      return sendError(
        res,
        `Payment amount mismatch. Expected: ${expectedAmountInKobo} Kobo, Paid: ${paystackData.amount} Kobo.`,
        400
      );
    }

    // Mark order as paid
    order.paymentStatus = PAYMENT_STATUS.PAID;
    order.orderStatus = ORDER_STATUS.PROCESSING;
    order.transactionId = paystackData.id ? String(paystackData.id) : null;
    order.paidAt = new Date();

    if (typeof order.save === 'function') await order.save();

    // Deduct stock after verified payment
    await deductProductStock(order.items);

    return sendSuccess(res, 'Payment verified successfully. Order confirmed.', {
      order,
      verified: true,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Paystack Webhook Listener
 * @route   POST /api/payment/webhook
 * @access  Public (Protected by Paystack HMAC Signature)
 */
export const handleWebhook = async (req, res, next) => {
  try {
    const signature = req.headers['x-paystack-signature'];
    const rawBody = req.rawBody || JSON.stringify(req.body);

    if (!signature || !verifyPaystackSignature(rawBody, signature)) {
      console.warn('⚠️ Rejected invalid Paystack webhook signature attempt.');
      return sendError(res, 'Invalid webhook signature.', 401);
    }

    const event = req.body;

    if (event.event === 'charge.success') {
      const { reference, amount, id: transactionId } = event.data;

      const order =
        mongoose.connection.readyState === 1
          ? await Order.findOne({
              $or: [{ paymentReference: reference }, { orderNumber: reference }],
            })
          : memoryStore.orders.find(
              (o) => o.paymentReference === reference || o.orderNumber === reference
            );

      if (order && order.paymentStatus !== PAYMENT_STATUS.PAID) {
        const expectedKobo = Math.round(order.total * 100);
        if (amount === expectedKobo) {
          order.paymentStatus = PAYMENT_STATUS.PAID;
          order.orderStatus = ORDER_STATUS.PROCESSING;
          order.transactionId = String(transactionId);
          order.paidAt = new Date();
          if (typeof order.save === 'function') await order.save();

          await deductProductStock(order.items);
          console.log(`✅ Webhook confirmed payment for order: ${order.orderNumber}`);
        } else {
          console.warn(`⚠️ Webhook amount mismatch for order ${order.orderNumber}`);
        }
      }
    }

    // Always acknowledge receipt to Paystack with 200 OK
    return res.status(200).json({ status: 'success' });
  } catch (error) {
    console.error('Paystack webhook error:', error);
    // Still return 200 so Paystack does not hammer server repeatedly
    return res.status(200).json({ status: 'received' });
  }
};
