# 🛍️ DMOSTHIGH Clothing Brand - Backend API

Production-ready, highly secure backend for the **DMOSTHIGH** clothing brand e-commerce platform. Built with **Node.js**, **Express**, **MongoDB / Mongoose**, **Cloudinary** for image storage, and **Paystack** for payments.

Designed from the ground up to integrate seamlessly with a modern **React + Vite** frontend.

---

## 📑 Table of Contents
- [Architecture & Tech Stack](#-architecture--tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [External Services Setup Guide](#-external-services-setup-guide)
  - [1. MongoDB Setup](#1-mongodb-setup)
  - [2. Cloudinary Setup](#2-cloudinary-setup)
  - [3. Paystack Setup](#3-paystack-setup)
- [Initial Admin Setup](#-initial-admin-setup)
- [API Reference](#-api-reference)
  - [Health Check](#health-check)
  - [Authentication](#authentication-apis)
  - [Products Catalog](#products-apis)
  - [Orders & Checkout](#orders--checkout-apis)
  - [Paystack Payments](#payment-apis)
  - [Image Uploads](#image-upload-apis)
  - [Admin Dashboard](#admin-dashboard-apis)
- [Frontend (React + Vite) Integration](#-frontend-react--vite-integration)
- [Testing & Verification](#-testing--verification)

---

## 🚀 Architecture & Tech Stack

- **Runtime**: Node.js (ES Modules, `"type": "module"`)
- **Web Framework**: Express.js
- **Database & ODM**: MongoDB with Mongoose
- **Image Management**: Cloudinary v2 SDK + Multer (streaming directly from memory buffer)
- **Payment Processing**: Paystack API (Transaction initialization, server verification, HMAC SHA512 webhook signature verification)
- **Authentication**: JWT (JSON Web Tokens) with `bcryptjs` password hashing (12 rounds)
- **Security Middleware**:
  - `helmet`: Secure HTTP response headers
  - `cors`: Configurable CORS origins with credential support
  - `express-rate-limit`: Rate limiting on auth, checkout, and general API endpoints
  - Server-calculated totals: Client prices are never trusted

---

## 📂 Project Structure

```
backend/
│
├── src/
│   ├── config/
│   │   ├── constants.js       # User roles, order statuses, fee constants
│   │   ├── db.js              # MongoDB Mongoose connection
│   │   ├── cloudinary.js      # Cloudinary upload & delete stream helpers
│   │   └── paystack.js        # Paystack init, verify, and webhook helpers
│   │
│   ├── controllers/
│   │   ├── authController.js     # Register, login, profile, logout
│   │   ├── productController.js  # Catalog, filtering, search, admin CRUD
│   │   ├── orderController.js    # Stock check, authoritative checkout, history
│   │   ├── paymentController.js  # Paystack initialization, verification, webhook
│   │   ├── uploadController.js   # Multi-image upload and deletion
│   │   └── adminController.js    # Stats, orders, status updates, customer lists
│   │
│   ├── middleware/
│   │   ├── authMiddleware.js     # Bearer JWT verification & optional auth
│   │   ├── adminMiddleware.js    # Role-based admin access guard
│   │   ├── uploadMiddleware.js   # Multer memory storage & image filter
│   │   ├── validatorMiddleware.js# express-validator runner & error formatter
│   │   ├── rateLimiter.js        # API, auth, and checkout rate limiters
│   │   └── errorMiddleware.js    # 404 handler and global error formatter
│   │
│   ├── models/
│   │   ├── User.js            # Customer & admin schema with bcrypt pre-save
│   │   ├── Product.js         # Slugified product catalog with discount rules
│   │   └── Order.js           # Full order breakdown, address, items, status
│   │
│   ├── routes/
│   │   ├── authRoutes.js      # /api/auth
│   │   ├── productRoutes.js   # /api/products
│   │   ├── orderRoutes.js     # /api/orders
│   │   ├── paymentRoutes.js   # /api/payment
│   │   ├── uploadRoutes.js    # /api/upload
│   │   └── adminRoutes.js     # /api/admin
│   │
│   ├── scripts/
│   │   ├── createAdmin.js     # Interactive CLI tool to create/promote admin
│   │   └── verifyEndpoints.js # Automated API test suite
│   │
│   ├── utils/
│   │   ├── apiResponse.js     # Standardized JSON response helpers
│   │   ├── generateToken.js   # JWT token generator
│   │   ├── orderNumber.js     # Human-friendly order ID (DMH-YYYYMMDD-XXXX)
│   │   └── slugify.js         # URL slug generator
│   │
│   └── server.js              # Express app bootstrap & route registration
│
├── .env                       # Local environment variables
├── .env.example               # Template environment variables
├── .gitignore
├── package.json
└── README.md
```

---

## 🛠️ Getting Started

### 1. Prerequisites
- **Node.js** (v18.0.0 or higher recommended, tested on Node v22)
- **npm** (comes with Node)

### 2. Installation
Dependencies are already installed. If starting in a new clone:
```bash
npm install
```

### 3. Running the Server
- **Development mode** (auto-restart on file change):
  ```bash
  npm run dev
  ```
- **Production mode**:
  ```bash
  npm start
  ```

---

## 🔑 External Services Setup Guide

The backend is completely built and functional. To enable live database persistence, Cloudinary image uploads, and Paystack transactions, provide the credentials below in your `.env` file:

### 1. MongoDB Setup
You can use either **MongoDB Atlas (Cloud - Recommended)** or **Local MongoDB**:

#### Option A: MongoDB Atlas (Free Cloud Database)
1. Go to [https://www.mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas) and sign up / log in.
2. Create a free **M0 Shared Cluster**.
3. Under **Database Access**, create a database user (e.g. `dmosthigh_user`) with a secure password.
4. Under **Network Access**, click **Add IP Address** -> select **Allow Access from Anywhere (`0.0.0.0/0`)** (for development).
5. Under **Clusters**, click **Connect** -> **Drivers (Node.js)** -> copy your connection string:
   ```
   mongodb+srv://<username>:<password>@<cluster>.mongodb.net/dmosthigh?retryWrites=true&w=majority
   ```
6. Open `.env` and set:
   ```env
   MONGODB_URI=mongodb+srv://YOUR_USER:YOUR_PASSWORD@cluster0.mongodb.net/dmosthigh?retryWrites=true&w=majority
   ```

#### Option B: Local MongoDB
If you install MongoDB Community Server locally:
```env
MONGODB_URI=mongodb://127.0.0.1:27017/dmosthigh
```

---

### 2. Cloudinary Setup
Cloudinary stores your clothing brand's product photos securely in the cloud.

1. Go to [https://cloudinary.com](https://cloudinary.com) and create a free account.
2. Open your **Cloudinary Dashboard / Console**: [https://console.cloudinary.com/](https://console.cloudinary.com/)
3. Locate your **Product Environment Credentials**:
   - **Cloud Name**
   - **API Key**
   - **API Secret**
4. Paste them into `.env`:
   ```env
   CLOUDINARY_CLOUD_NAME=your_actual_cloud_name
   CLOUDINARY_API_KEY=your_actual_api_key
   CLOUDINARY_API_SECRET=your_actual_api_secret
   ```

---

### 3. Paystack Setup
Paystack handles payments in Naira (NGN) via card, bank transfer, and USSD.

1. Go to [https://dashboard.paystack.com/](https://dashboard.paystack.com/) and register or log in.
2. Navigate to **Settings** -> **API Keys & Webhooks** ([https://dashboard.paystack.com/#/settings/developer](https://dashboard.paystack.com/#/settings/developer)).
3. Copy your test keys:
   - **Secret Key**: starts with `sk_test_...`
   - **Public Key**: starts with `pk_test_...`
4. Paste them into `.env`:
   ```env
   PAYSTACK_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
   PAYSTACK_PUBLIC_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
5. *(Optional for webhooks)* Under **Webhook URL**, specify your server URL + `/api/payment/webhook` (e.g. using ngrok for local testing: `https://your-ngrok.app/api/payment/webhook`).

---

## 👑 Initial Admin Setup

Admins cannot be created via public registration. To create the first administrator account:

Run the interactive admin creation CLI:
```bash
npm run create-admin
```
Or with CLI arguments:
```bash
node src/scripts/createAdmin.js --name "Admin Name" --email "admin@dmosthigh.com" --password "YourStrongPassword"
```
The script hashes the password and assigns the user `role: "admin"`. If the user already exists, it promotes them to admin.

---

## 📡 API Reference

### Health Check
- `GET /api/health`
  - **Description**: Returns system health, environment, and uptime.
  - **Response (200)**:
    ```json
    {
      "success": true,
      "message": "DMOSTHIGH Clothing Brand API is running",
      "environment": "development",
      "uptime": "120s"
    }
    ```

---

### Authentication APIs (`/api/auth`)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | Public | Register customer account |
| `POST` | `/api/auth/login` | Public | Log in customer or admin, returns JWT |
| `POST` | `/api/auth/logout` | Public | Invalidate/log out session |
| `GET` | `/api/auth/me` | Authenticated | Retrieve current user profile |
| `PUT` | `/api/auth/profile` | Authenticated | Update name, phone, or delivery address |

#### Sample Register Request (`POST /api/auth/register`):
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "phone": "08012345678",
  "password": "secretpassword123",
  "address": {
    "address": "12 Marina Street",
    "city": "Lekki",
    "state": "Lagos",
    "country": "Nigeria"
  }
}
```

---

### Products APIs (`/api/products`)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/products` | Public | List products with search, filters, pagination |
| `GET` | `/api/products/:id` | Public | Get product by MongoDB `_id` |
| `GET` | `/api/products/slug/:slug` | Public | Get product by URL slug |
| `POST` | `/api/products` | Admin | Create a new product |
| `PUT` | `/api/products/:id` | Admin | Update product details |
| `DELETE` | `/api/products/:id` | Admin | Delete product & Cloudinary images |
| `PATCH` | `/api/products/:id/status` | Admin | Activate or deactivate product |
| `PATCH` | `/api/products/:id/stock` | Admin | Update inventory stock count |
| `PATCH` | `/api/products/:id/discount`| Admin | Set or remove discount price |

#### Query Parameters for `GET /api/products`:
- `search=hoodie` (matches name, description, category)
- `category=jackets`
- `featured=true`
- `minPrice=10000&maxPrice=50000`
- `sort=price-low` (`price-low`, `price-high`, `newest`, `oldest`, `name-asc`, `name-desc`)
- `page=1&limit=20`

#### Sample Create Product Request (`POST /api/products`):
```json
{
  "name": "DMOSTHIGH Signature Oversized Hoodie",
  "description": "Heavyweight 450GSM organic cotton hoodie featuring premium puff print embroidery.",
  "category": "hoodies",
  "price": 45000,
  "discountPrice": 38000,
  "stock": 50,
  "sizes": ["S", "M", "L", "XL", "XXL"],
  "colors": ["Midnight Black", "Vintage Washed Grey"],
  "featured": true,
  "images": [
    {
      "public_id": "dmosthigh/products/hoodie_front",
      "url": "https://res.cloudinary.com/demo/image/upload/v1/hoodie_front.jpg"
    }
  ]
}
```

---

### Orders & Checkout APIs (`/api/orders`)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/orders/checkout` | Public / Customer | Verify stock, recalculate totals, create pending order, init Paystack |
| `GET` | `/api/orders/my-orders` | Authenticated | Customer's personal order history |
| `GET` | `/api/orders/:id` | Owner / Admin | Order detail view |

#### Sample Checkout Request (`POST /api/orders/checkout`):
```json
{
  "items": [
    {
      "productId": "64f1a2b3c4d5e6f7a8b9c0d1",
      "quantity": 1,
      "size": "L",
      "color": "Midnight Black"
    }
  ],
  "customer": {
    "name": "Jane Doe",
    "email": "jane@example.com",
    "phone": "08012345678",
    "address": "12 Marina Street",
    "city": "Lekki",
    "state": "Lagos",
    "country": "Nigeria"
  },
  "callback_url": "http://localhost:5173/order/confirmation"
}
```
> **Security Guarantee**: The backend looks up the true database price of every product, checks stock, adds the configured `SHIPPING_FEE`, and calculates the total on the server. Frontend-submitted prices are completely ignored.

---

### Payment APIs (`/api/payment`)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/payment/initialize` | Public | Initialize Paystack transaction for an existing order |
| `GET` | `/api/payment/verify/:reference` | Public | Verify payment status with Paystack, update order to PAID, decrement stock |
| `POST` | `/api/payment/webhook` | Paystack Only | Secure webhook with HMAC SHA512 signature verification |

---

### Image Upload APIs (`/api/upload`)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/upload/images` | Admin | Upload up to 8 images (`multipart/form-data`) to Cloudinary |
| `DELETE` | `/api/upload/images/:publicId` | Admin | Delete an image from Cloudinary |

---

### Admin Dashboard APIs (`/api/admin`)
*(All require `Authorization: Bearer <ADMIN_TOKEN>`)*

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/admin/dashboard` | Aggregated metrics: total orders, breakdown by status, revenue, total customers, total products, recent 5 orders |
| `GET` | `/api/admin/orders` | All customer orders with status filters (`pending`, `paid`, `processing`, `shipped`, `delivered`, `cancelled`) and search |
| `GET` | `/api/admin/orders/:id`| Full order breakdown with customer and product details |
| `PATCH` | `/api/admin/orders/:id/status`| Update order status (e.g. mark as `shipped` or `delivered`) |
| `GET` | `/api/admin/customers` | Customer list with total order counts |
| `GET` | `/api/admin/products` | All products including active and inactive items |

---

## 💻 Frontend (React + Vite) Integration

### Setting Up Axios / Fetch:
```javascript
// src/api/client.js
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',
  withCredentials: true,
});

// Attach JWT token automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('dmh_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
```

### Typical Checkout Flow in React:
```javascript
// 1. Submit cart to checkout
const { data } = await api.post('/orders/checkout', { items, customer });

// 2. If Paystack returned an authorization URL, redirect customer to Paystack
if (data.data.payment?.authorization_url) {
  window.location.href = data.data.payment.authorization_url;
}

// 3. On return to confirmation page, verify reference:
const response = await api.get(`/payment/verify/${reference}`);
if (response.data.data.verified) {
  console.log('Order successfully confirmed!');
}
```

---

## 🧪 Testing & Verification

Run the automated endpoint test suite at any time:
```bash
npm test
```
The test suite verifies:
- API health check (`/api/health`)
- Root welcome route
- 404 handler format
- Auth validation (register & login)
- Protected route security guards
- Checkout and payment validation
- Admin authorization barriers
