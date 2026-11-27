# NovaMart - Full-Stack E-Commerce Platform

A production-ready full-stack e-commerce web application with **Customer Storefront (in Indian Rupees ₹ INR)**, **Payment Gateway Simulation**, **Real-Time Order Tracking**, **Promotional Coupons**, **Password Eye Visibility Toggle**, and an **Admin Command Center with Authentication Gating & Manual Customer Verification**, built according to UML Use Case architecture.

Configured for **one-click deployment to Vercel**, cloud tunneling for mobile device testing, and direct push to GitHub.

---

## 🌟 Key Features

### 🛒 Customer Storefront
- **Indian Rupee (₹ INR) & GST**: Complete catalog, cart, checkout, tracking, and receipts formatted in Indian Rupees (`₹`) with 18% GST calculation.
- **20 Curated Products across 5 Categories**: Electronics, Audio, Wearables, Home & Lifestyle, and Accessories.
- **Account Registration with Password Eye Toggle**: Password visibility toggle ("eye button") on login and registration fields to switch between masked dots and plain text.
- **Slide-Over Cart Drawer**: Quantity adjustment, free shipping threshold indicator (Free shipping for orders over ₹999), and subtotal computation.
- **Promotional Coupons (Before Payment)**: Apply coupon codes with 1-click pills (`WELCOME10`, `FESTIVE20`, `FLAT500`, `FREESHIP`, `MEGA50`) that deduct savings live from the total before checkout payment authorization.
- **Multi-Step Checkout & Payment Simulation**: Test card autofill, UPI / QR, and Cash on Delivery options with atomic stock decrements.
- **Live Milestone Shipment Tracking**: Visual carrier timeline (*Placed → Payment Confirmed → Hub Processing → In Transit → Out for Delivery → Delivered*).
- **Order Cancellation**: Customers can cancel pending orders to automatically restore inventory and issue refunds.

### 🛡️ Admin Control Panel (Secured & Gated)
- **Role-Based Access Control**: Admin panel is hidden by default and accessible only after signing in with administrator credentials (`admin@store.com` / `admin123`).
- **Product Management & Deletion**: Add new items or delete existing catalog products directly with 1 click.
- **Customer Verification**: Review customer accounts, approve accounts with automated email notifications, send verification token links, or reject accounts.
- **Shipment Management**: Advance tracking milestones with carrier status update notifications.
- **Analytics & Financial Reports**: Total revenue, orders count, average order value, category breakdowns, and exportable summaries.

### ✉️ In-App Mailbox Inspector
- Click the **Mailbox Icon (✉)** in the header to view all transactional emails (Order Confirmations, Account Approvals, Status Updates) in rich responsive HTML.

---

## 🎟️ Available Promo Coupons

| Coupon Code | Discount Offer | Criteria |
| :--- | :--- | :--- |
| `WELCOME10` | **10% OFF** entire order | All orders |
| `FESTIVE20` | **20% OFF** festive discount | All orders |
| `FLAT500` | **₹500 Flat OFF** | Minimum order ₹1,500 |
| `FREESHIP` | **Free Express Delivery** | Saves ₹99 shipping fee |
| `MEGA50` | **50% OFF** mega discount | Demo & test orders |

---

## 🔑 Demo Login Accounts

| Role | Email | Password | Status | Access Level |
| :--- | :--- | :--- | :--- | :--- |
| **Store Admin** | `admin@store.com` | `admin123` | Approved | Unlocks the Admin Command Center, product deletion, user approvals, orders & analytics. |
| **Verified Customer** | `john@example.com` | `customer123` | Approved | Immediate cart, coupon checkout, tracking, and product reviews. |
| **Pending Customer** | `alice@example.com` | `alice123` | Pending Approval | Test registration flow and administrator approval. |

---

## 🚀 Running the Store

### 1. Independent Launcher (Runs 24/7 on Phone & Laptop without IDE)
Double-click `start-online.bat` on Windows. This opens two independent windows:
1. Node.js backend server on `http://localhost:3000`
2. Cloudflare public tunnel providing a public `https://*.trycloudflare.com` URL accessible on mobile phones.

To stop the background processes, run `stop-online.bat`.

### 2. Manual Development Server
```bash
# Start local server
node api/index.js
```
Open `http://localhost:3000` in your browser.

---

## 📁 Repository Structure

```text
├── api/
│   ├── index.js          # HTTP server, REST endpoints & coupon validator
│   ├── db.js             # JSON persistence engine with INR products
│   ├── auth.js           # Salted PBKDF2 password hashing & token auth
│   └── mailer.js         # Email dispatcher with HTML receipt templates
├── data/
│   └── store.json        # Persistent store database
├── public/
│   ├── index.html        # Responsive single-page application
│   ├── css/
│   │   └── style.css     # Tailwind CSS styles & animations
│   └── js/
│       └── app.js        # Frontend application logic, coupons & modals
├── start-online.bat      # Independent background launcher with Cloudflare tunnel
├── stop-online.bat       # Process terminator for launcher
├── run.bat               # Windows local launcher
├── vercel.json           # Vercel serverless deployment configuration
├── package.json          # Package descriptor
└── README.md             # Project documentation
```

---

## 🌐 Deploy to Vercel

1. Push this repository to GitHub.
2. Log in to [Vercel](https://vercel.com) and click **"Add New..." → "Project"**.
3. Select your GitHub repository.
4. Keep the default settings and click **"Deploy"**.
