import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { db, hashPassword } from './db.js';
import { verifyPassword, generateToken, authenticate } from './auth.js';
import {
  sendRegistrationPendingEmail,
  sendAccountApprovedEmail,
  sendVerificationTokenLinkEmail,
  sendAccountRejectedEmail,
  sendOrderConfirmationEmail,
  sendOrderCancellationEmail,
  sendRefundConfirmationEmail,
  sendDeliveryStatusUpdateEmail,
  sendReturnConfirmationEmail
} from './mailer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// Load environment variables from .env file if present
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const idx = trimmed.indexOf('=');
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (!process.env[key]) process.env[key] = val;
      }
    }
  } catch {}
}

// MIME types for static local file serving
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function parseBody(req) {
  return new Promise((resolve, reject) => {
    // If body already parsed by Vercel/Express
    if (req.body && typeof req.body === 'object') {
      return resolve(req.body);
    }
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 5 * 1024 * 1024) reject(new Error('Payload too large'));
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve({ raw: body });
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

function validateRegistration({ name, email, password }) {
  if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string' || !name.trim() || !email.trim() || !password) {
    return 'Name, email, and password are required';
  }
  if (name.trim().length > 100) return 'Name must be 100 characters or fewer';
  if (!EMAIL_PATTERN.test(email.trim()) || email.length > 254) return 'Please enter a valid email address';
  if (password.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  if (password.length > 128) return 'Password must be 128 characters or fewer';
  return null;
}

function sendError(res, statusCode, message, details = {}) {
  sendJson(res, statusCode, { error: message, ...details });
}

function serveStatic(req, res, pathname) {
  let safePath = pathname === '/' ? '/index.html' : pathname;
  let filePath = path.resolve(PUBLIC_DIR, `.${safePath}`);
  const publicRoot = path.resolve(PUBLIC_DIR);

  if (filePath !== publicRoot && !filePath.startsWith(publicRoot + path.sep)) {
    return sendError(res, 403, 'Forbidden');
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(PUBLIC_DIR, 'index.html');
  }

  if (!fs.existsSync(filePath)) {
    return sendError(res, 404, 'Not Found');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) return sendError(res, 500, 'Server read error');
    res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-cache' });
    res.end(content);
  });
}

// Master Handler for Vercel Serverless Function & Local HTTP Server
export default async function handler(req, res) {
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
  const reqUrl = new URL(req.url, `${proto}://${host}`);
  const pathname = reqUrl.pathname;
  const method = req.method;
  const baseUrl = `${proto}://${host}`;

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end();
    return;
  }

  // --- API ROUTES ---
  if (pathname.startsWith('/api/') || pathname === '/api') {
    try {
      const user = authenticate(req);

      // Public Store Settings (Registration toggle & approval mode)
      if (pathname === '/api/settings/public' && method === 'GET') {
        return sendJson(res, 200, { settings: db.getSettings() });
      }

      // Admin Update Store Settings
      if (pathname === '/api/admin/settings' && (method === 'PUT' || method === 'PATCH')) {
        if (!user || user.role !== 'admin') return sendError(res, 403, 'Admin access required');
        const body = await parseBody(req);
        const updates = {};
        if (typeof body.allowPublicRegistration === 'boolean') {
          updates.allowPublicRegistration = body.allowPublicRegistration;
        }
        if (typeof body.requireAdminApproval === 'boolean') {
          updates.requireAdminApproval = body.requireAdminApproval;
        }
        const settings = db.updateSettings(updates);
        return sendJson(res, 200, { success: true, message: 'Registration settings updated.', settings });
      }

      // Register Customer
      if (pathname === '/api/auth/register' && method === 'POST') {
        const settings = db.getSettings();
        if (!settings.allowPublicRegistration) {
          return sendError(res, 403, 'New user registration is currently disabled by the administrator.');
        }

        const body = await parseBody(req);
        const { name, email, password, phone, address } = body;

        const registrationError = validateRegistration(body);
        if (registrationError) return sendError(res, 400, registrationError);

        const existing = db.getUserByEmail(email);
        if (existing) {
          return sendError(res, 409, 'An account with this email already exists.');
        }

        const pass = hashPassword(password);
        const autoApprove = !settings.requireAdminApproval;
        const verificationToken = autoApprove ? null : `tok_${crypto.randomBytes(24).toString('hex')}`;

        const newUser = {
          id: `usr_${crypto.randomUUID().slice(0, 8)}`,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          passwordHash: pass.hash,
          salt: pass.salt,
          role: 'customer',
          status: autoApprove ? 'approved' : 'pending_approval',
          phone: phone || '',
          address: address || { street: '', city: '', state: '', zip: '' },
          verificationToken,
          verifiedAt: autoApprove ? new Date().toISOString() : null,
          rejectionReason: null,
          createdAt: new Date().toISOString()
        };

        db.addUser(newUser);
        if (autoApprove) {
          await sendAccountApprovedEmail(newUser, baseUrl);
          const token = generateToken(newUser);
          return sendJson(res, 201, {
            success: true,
            status: 'approved',
            token,
            message: 'Registration successful! Your account is active.',
            user: {
              id: newUser.id,
              name: newUser.name,
              email: newUser.email,
              role: newUser.role,
              status: newUser.status,
              phone: newUser.phone,
              address: newUser.address,
              createdAt: newUser.createdAt
            }
          });
        }

        await sendRegistrationPendingEmail(newUser);

        return sendJson(res, 201, {
          success: true,
          status: 'pending_approval',
          message: 'Registration successful! Waiting for admin approval.',
          user: {
            id: newUser.id,
            name: newUser.name,
            email: newUser.email,
            role: newUser.role,
            status: newUser.status,
            createdAt: newUser.createdAt
          }
        });
      }

      // Login
      if (pathname === '/api/auth/login' && method === 'POST') {
        const body = await parseBody(req);
        const { email, password, adminOnly } = body;

        if (!email || !password) {
          return sendError(res, 400, 'Email and password are required');
        }

        const foundUser = db.getUserByEmail(email);
        if (!foundUser || !verifyPassword(password, foundUser.salt, foundUser.passwordHash)) {
          return sendError(res, 401, 'Invalid email or password.');
        }

        if (adminOnly && foundUser.role !== 'admin') {
          return sendError(res, 403, 'Administrator credentials required to use Admin Login.');
        }

        if (foundUser.role === 'customer') {
          if (foundUser.status === 'pending_approval') {
            return sendError(res, 403, 'Account Pending Approval', {
              code: 'PENDING_APPROVAL',
              message: 'Registration successful! Waiting for admin approval.'
            });
          }
          if (foundUser.status === 'rejected') {
            return sendError(res, 403, 'Account Rejected', {
              code: 'ACCOUNT_REJECTED',
              message: 'Your account registration was rejected by the administrator.',
              reason: foundUser.rejectionReason
            });
          }
        }

        const token = generateToken(foundUser);
        return sendJson(res, 200, {
          success: true,
          token,
          user: {
            id: foundUser.id,
            name: foundUser.name,
            email: foundUser.email,
            role: foundUser.role,
            status: foundUser.status,
            phone: foundUser.phone,
            address: foundUser.address
          }
        });
      }

      // Current User
      if (pathname === '/api/auth/me' && method === 'GET') {
        if (!user) return sendError(res, 401, 'Unauthorized');
        return sendJson(res, 200, {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            status: user.status,
            phone: user.phone,
            address: user.address,
            createdAt: user.createdAt
          }
        });
      }

      // Verify Token Link
      if (pathname === '/api/auth/verify-token' && method === 'GET') {
        const token = reqUrl.searchParams.get('token');
        if (!token) return sendError(res, 400, 'Token is required');

        const targetUser = db.getUserByToken(token);
        if (!targetUser) return sendError(res, 404, 'Invalid or expired verification link.');

        const updated = db.updateUser(targetUser.id, {
          status: 'approved',
          verifiedAt: new Date().toISOString(),
          verificationToken: null
        });

        await sendAccountApprovedEmail(updated, baseUrl);
        return sendJson(res, 200, {
          success: true,
          message: 'Email verified successfully! You may now sign in.',
          email: updated.email
        });
      }

      // Quick Demo Login
      if (pathname === '/api/auth/demo-login' && method === 'POST') {
        if (process.env.ENABLE_DEMO_LOGIN !== 'true') {
          return sendError(res, 403, 'Demo login is disabled.');
        }
        const body = await parseBody(req);
        const { email } = body;
        const target = db.getUserByEmail(email || 'admin@store.com');
        if (!target) return sendError(res, 404, 'User not found');

        const token = generateToken(target);
        return sendJson(res, 200, {
          success: true,
          token,
          user: target
        });
      }

      // ADMIN: Users, Customers & Manual Approvals
      if (pathname === '/api/admin/customers' && method === 'GET') {
        if (!user || user.role !== 'admin') return sendError(res, 403, 'Admin access required');

        const allUsers = db.getUsers();
        const orders = db.getOrders();

        const enriched = allUsers.map(u => {
          const userOrders = orders.filter(o => o.customerId === u.id);
          const totalSpent = userOrders.reduce((sum, o) => sum + (o.paymentStatus === 'completed' ? o.totalAmount : 0), 0);
          return {
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
            status: u.status,
            phone: u.phone,
            address: u.address,
            verifiedAt: u.verifiedAt,
            rejectionReason: u.rejectionReason,
            createdAt: u.createdAt,
            orderCount: userOrders.length,
            totalSpent: parseFloat(totalSpent.toFixed(2))
          };
        });

        return sendJson(res, 200, { customers: enriched, settings: db.getSettings() });
      }

      // Admin Registers / Creates a New User Directly
      if (pathname === '/api/admin/users' && method === 'POST') {
        if (!user || user.role !== 'admin') return sendError(res, 403, 'Admin access required');
        const body = await parseBody(req);
        const { name, email, password, phone, address, role, status } = body;

        const registrationError = validateRegistration(body);
        if (registrationError) return sendError(res, 400, registrationError);

        const existing = db.getUserByEmail(email);
        if (existing) {
          return sendError(res, 409, 'An account with this email already exists.');
        }

        const allowedRole = role === 'admin' ? 'admin' : 'customer';
        const allowedStatus = status === 'pending_approval' ? 'pending_approval' : 'approved';
        const pass = hashPassword(password);
        const verificationToken = allowedStatus === 'pending_approval'
          ? `tok_${crypto.randomBytes(24).toString('hex')}`
          : null;

        const newUser = {
          id: `usr_${crypto.randomUUID().slice(0, 8)}`,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          passwordHash: pass.hash,
          salt: pass.salt,
          role: allowedRole,
          status: allowedStatus,
          phone: phone || '',
          address: typeof address === 'string' ? { city: address } : (address || { street: '', city: '', state: '', zip: '' }),
          verificationToken,
          verifiedAt: allowedStatus === 'approved' ? new Date().toISOString() : null,
          rejectionReason: null,
          createdAt: new Date().toISOString()
        };

        db.addUser(newUser);
        if (allowedStatus === 'approved') {
          await sendAccountApprovedEmail(newUser, baseUrl);
        } else {
          await sendRegistrationPendingEmail(newUser);
        }

        return sendJson(res, 201, {
          success: true,
          message: `User "${newUser.name}" (${allowedRole}) registered with status "${allowedStatus}".`,
          user: {
            id: newUser.id,
            name: newUser.name,
            email: newUser.email,
            role: newUser.role,
            status: newUser.status,
            phone: newUser.phone,
            address: newUser.address,
            createdAt: newUser.createdAt
          }
        });
      }

      // Admin Approves Customer
      if (pathname.match(/^\/api\/admin\/customers\/([^/]+)\/approve$/) && method === 'POST') {
        if (!user || user.role !== 'admin') return sendError(res, 403, 'Admin access required');
        const customerId = pathname.split('/')[4];
        const target = db.getUserById(customerId);
        if (!target) return sendError(res, 404, 'Customer not found');

        const updated = db.updateUser(customerId, {
          status: 'approved',
          verifiedAt: new Date().toISOString(),
          rejectionReason: null
        });

        const emailRecord = await sendAccountApprovedEmail(updated, baseUrl);
        return sendJson(res, 200, {
          success: true,
          message: `Customer ${updated.name} approved! Activation email dispatched.`,
          customer: updated,
          emailSent: emailRecord
        });
      }

      // Admin Rejects Customer
      if (pathname.match(/^\/api\/admin\/customers\/([^/]+)\/reject$/) && method === 'POST') {
        if (!user || user.role !== 'admin') return sendError(res, 403, 'Admin access required');
        const customerId = pathname.split('/')[4];
        const body = await parseBody(req);
        const reason = body.reason || 'Account details failed verification.';

        const target = db.getUserById(customerId);
        if (!target) return sendError(res, 404, 'Customer not found');

        const updated = db.updateUser(customerId, { status: 'rejected', rejectionReason: reason });
        await sendAccountRejectedEmail(updated, reason);

        return sendJson(res, 200, { success: true, message: 'Customer rejected.', customer: updated });
      }

      // Admin Sends Verification Token Email
      if (pathname.match(/^\/api\/admin\/customers\/([^/]+)\/send-verification-email$/) && method === 'POST') {
        if (!user || user.role !== 'admin') return sendError(res, 403, 'Admin access required');
        const customerId = pathname.split('/')[4];
        const target = db.getUserById(customerId);
        if (!target) return sendError(res, 404, 'Customer not found');

        const token = target.verificationToken || `tok_${crypto.randomBytes(24).toString('hex')}`;
        db.updateUser(customerId, { verificationToken: token });

        const emailRecord = await sendVerificationTokenLinkEmail(target, token, baseUrl);
        return sendJson(res, 200, { success: true, message: `Verification email sent.`, emailSent: emailRecord });
      }

      // Admin Deletes Customer
      if (pathname.match(/^\/api\/admin\/customers\/([^/]+)$/) && method === 'DELETE') {
        if (!user || user.role !== 'admin') return sendError(res, 403, 'Admin access required');
        const customerId = pathname.split('/')[4];
        if (customerId === user.id || customerId === 'usr_admin') {
          return sendError(res, 400, 'Cannot delete the active primary administrator account.');
        }
        db.deleteUser(customerId);
        return sendJson(res, 200, { success: true, message: 'User deleted.' });
      }

      // PRODUCTS & CATEGORIES
      if (pathname === '/api/products' && method === 'GET') {
        let prods = [...db.getProducts()];
        const category = reqUrl.searchParams.get('category');
        const search = reqUrl.searchParams.get('search');
        const sortBy = reqUrl.searchParams.get('sortBy');

        if (category && category !== 'all') {
          const catLower = category.toLowerCase().trim();
          prods = prods.filter(p => {
            const pCatId = (p.categoryId || '').toLowerCase();
            const pCatName = (p.categoryName || '').toLowerCase();
            const pName = (p.name || '').toLowerCase();

            // Direct ID or name match
            if (pCatId === catLower || pCatId === `cat_${catLower}` || pCatName.includes(catLower)) {
              return true;
            }

            // Keyword aliases
            if (catLower === 'wearables' || catLower === 'cat_wearables') {
              return pCatId === 'cat_wearables' || pCatName.includes('wearable') || pCatName.includes('watch') || pName.includes('watch') || pName.includes('tracker') || pName.includes('fitness band') || pName.includes('smart ring');
            }
            if (catLower === 'audio' || catLower === 'cat_audio') {
              return pCatId === 'cat_audio' || pCatName.includes('audio') || pCatName.includes('sound') || pName.includes('headphone') || pName.includes('earbud') || pName.includes('speaker') || pName.includes('soundbar');
            }
            if (catLower === 'electronics' || catLower === 'cat_electronics') {
              return pCatId === 'cat_electronics' || pCatName.includes('electronic') || pCatName.includes('gadget');
            }
            if (catLower === 'shoes' || catLower === 'footwear' || catLower === 'sneakers') {
              return (pCatId === 'cat_fashion' || pCatId === 'cat_sports') && (pName.includes('shoe') || pName.includes('sneaker') || pName.includes('loafer') || pName.includes('sandal') || pName.includes('slide') || pName.includes('boot') || pName.includes('trainer') || pName.includes('footwear'));
            }
            if (catLower === 'tshirt' || catLower === 't-shirt' || catLower === 'polos') {
              return pCatId === 'cat_fashion' && (pName.includes('shirt') || pName.includes('tee') || pName.includes('polo') || pName.includes('top') || pName.includes('hoodie'));
            }
            if (catLower === 'gaming' || catLower === 'gaming-tech') {
              return pCatId === 'cat_electronics' && (pName.includes('game') || pName.includes('console') || pName.includes('mouse') || pName.includes('pad') || pName.includes('cable') || pName.includes('mic') || pName.includes('earphone') || pName.includes('fan') || pName.includes('hub') || pName.includes('controller'));
            }
            if (catLower === 'fashion' || catLower === 'cat_fashion' || catLower === 'apparel') {
              return pCatId === 'cat_fashion' || pCatName.includes('fashion') || pCatName.includes('apparel');
            }
            if (catLower === 'home' || catLower === 'cat_home' || catLower === 'home-living') {
              return pCatId === 'cat_home' || pCatName.includes('home') || pCatName.includes('living') || pCatName.includes('kitchen');
            }
            if (catLower === 'beauty' || catLower === 'cat_beauty') {
              return pCatId === 'cat_beauty' || pCatName.includes('beauty') || pCatName.includes('wellness');
            }
            if (catLower === 'sports' || catLower === 'cat_sports') {
              return pCatId === 'cat_sports' || pCatName.includes('sports') || pCatName.includes('outdoors') || pCatName.includes('fitness');
            }
            if (catLower === 'accessories') {
              return pCatId === 'cat_fashion' || pName.includes('sunglasses') || pName.includes('bag') || pName.includes('duffel') || pName.includes('power bank');
            }

            return false;
          });
        }
        if (search) {
          const q = search.toLowerCase().trim();
          prods = prods.filter(p => {
            const pName = (p.name || '').toLowerCase();
            const pDesc = (p.description || '').toLowerCase();
            const pCat = (p.categoryName || '').toLowerCase();
            const pSpecs = (p.specs || []).join(' ').toLowerCase();
            const fullText = `${pName} ${pDesc} ${pCat} ${pSpecs}`;
            
            if (fullText.includes(q)) return true;

            const terms = q.split(/\s+/).filter(Boolean);
            return terms.every(term => {
              if (fullText.includes(term)) return true;
              // Singular / plural checks (e.g. headphone vs headphones, shoe vs shoes)
              if (term.endsWith('s') && term.length > 3 && fullText.includes(term.slice(0, -1))) return true;
              if (fullText.includes(term + 's')) return true;
              if (term === 'headphone' && (fullText.includes('headphone') || fullText.includes('earbud') || fullText.includes('audio') || fullText.includes('headset'))) return true;
              if (term === 'earphone' && (fullText.includes('earphone') || fullText.includes('earbud') || fullText.includes('headphone'))) return true;
              return false;
            });
          });
        }

        const maxPrice = reqUrl.searchParams.get('maxPrice');
        const minPrice = reqUrl.searchParams.get('minPrice');
        const offer = reqUrl.searchParams.get('offer');

        if (maxPrice) {
          const max = parseFloat(maxPrice);
          if (!isNaN(max)) prods = prods.filter(p => p.price <= max);
        }
        if (minPrice) {
          const min = parseFloat(minPrice);
          if (!isNaN(min)) prods = prods.filter(p => p.price >= min);
        }
        if (offer === 'under299') {
          prods = prods.filter(p => p.price <= 299);
        }
        if (offer === 'under399') {
          prods = prods.filter(p => p.price <= 399);
        }
        if (sortBy === 'price_asc') prods.sort((a, b) => a.price - b.price);
        if (sortBy === 'price_desc') prods.sort((a, b) => b.price - a.price);
        if (sortBy === 'rating') prods.sort((a, b) => b.rating - a.rating);

        return sendJson(res, 200, { products: prods });
      }

      if (pathname.match(/^\/api\/products\/([^/]+)$/) && method === 'GET') {
        const prodId = pathname.split('/')[3];
        const prod = db.getProductById(prodId);
        if (!prod) return sendError(res, 404, 'Product not found');
        return sendJson(res, 200, { product: prod, reviews: db.getReviews(prodId) });
      }

      if (pathname === '/api/admin/products' && method === 'POST') {
        if (!user || user.role !== 'admin') return sendError(res, 403, 'Admin access required');
        const body = await parseBody(req);
        if (!body.name || !String(body.name).trim()) {
          return sendError(res, 400, 'Product name is required');
        }
        const price = parseFloat(body.price);
        if (!Number.isFinite(price) || price < 0) {
          return sendError(res, 400, 'Valid product price is required');
        }
        const stock = parseInt(body.stock, 10);
        const cat = db.getCategoryById(body.categoryId);
        const specs = Array.isArray(body.specs)
          ? body.specs
          : (typeof body.specs === 'string'
            ? body.specs.split(',').map(s => s.trim()).filter(Boolean)
            : []);
        const newProduct = {
          id: `prod_${crypto.randomUUID().slice(0, 8)}`,
          name: String(body.name).trim(),
          categoryId: body.categoryId,
          categoryName: cat ? cat.name : 'General',
          price,
          stock: Number.isInteger(stock) && stock >= 0 ? stock : 0,
          description: body.description || '',
          rating: 5.0,
          reviewCount: 0,
          featured: Boolean(body.featured),
          image: body.image || 'https://picsum.photos/seed/novamart-static-1/800/800',
          specs,
          createdAt: new Date().toISOString()
        };
        db.addProduct(newProduct);
        return sendJson(res, 201, { success: true, product: newProduct });
      }

      if (pathname.match(/^\/api\/admin\/products\/([^/]+)$/) && (method === 'PUT' || method === 'PATCH')) {
        if (!user || user.role !== 'admin') return sendError(res, 403, 'Admin access required');
        const prodId = pathname.split('/')[4];
        const existing = db.getProductById(prodId);
        if (!existing) return sendError(res, 404, 'Product not found');

        const body = await parseBody(req);
        const updates = { updatedAt: new Date().toISOString() };

        if (body.name !== undefined) {
          const cleanName = String(body.name).trim();
          if (!cleanName) return sendError(res, 400, 'Product name cannot be empty');
          updates.name = cleanName;
        }
        if (body.categoryId !== undefined) {
          const cat = db.getCategoryById(body.categoryId);
          updates.categoryId = body.categoryId;
          updates.categoryName = cat ? cat.name : (body.categoryName || existing.categoryName || 'General');
        }
        if (body.price !== undefined) {
          const price = parseFloat(body.price);
          if (!Number.isFinite(price) || price < 0) {
            return sendError(res, 400, 'Price must be a valid non-negative number');
          }
          updates.price = price;
        }
        if (body.stock !== undefined) {
          const stock = parseInt(body.stock, 10);
          if (!Number.isInteger(stock) || stock < 0) {
            return sendError(res, 400, 'Stock must be a non-negative integer');
          }
          updates.stock = stock;
        }
        if (body.description !== undefined) updates.description = String(body.description);
        if (body.featured !== undefined) updates.featured = Boolean(body.featured);
        if (body.image !== undefined && String(body.image).trim()) updates.image = String(body.image).trim();
        if (body.specs !== undefined) {
          updates.specs = Array.isArray(body.specs)
            ? body.specs.map(s => String(s).trim()).filter(Boolean)
            : String(body.specs).split(',').map(s => s.trim()).filter(Boolean);
        }

        const updated = db.updateProduct(prodId, updates);
        return sendJson(res, 200, {
          success: true,
          message: `Product "${updated.name}" updated successfully.`,
          product: updated
        });
      }

      if (pathname.match(/^\/api\/admin\/products\/([^/]+)$/) && method === 'DELETE') {
        if (!user || user.role !== 'admin') return sendError(res, 403, 'Admin access required');
        db.deleteProduct(pathname.split('/')[4]);
        return sendJson(res, 200, { success: true });
      }

      if (pathname === '/api/categories' && method === 'GET') {
        const cats = db.getCategories();
        const prods = db.getProducts();
        return sendJson(res, 200, {
          categories: cats.map(c => ({ ...c, itemCount: prods.filter(p => p.categoryId === c.id).length }))
        });
      }

      if (pathname === '/api/admin/categories' && method === 'POST') {
        if (!user || user.role !== 'admin') return sendError(res, 403, 'Admin access required');
        const body = await parseBody(req);
        const newCat = {
          id: `cat_${body.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
          name: body.name.trim(),
          description: body.description || ''
        };
        db.addCategory(newCat);
        return sendJson(res, 201, { success: true, category: newCat });
      }

      if (pathname.match(/^\/api\/admin\/categories\/([^/]+)$/) && (method === 'PUT' || method === 'PATCH')) {
        if (!user || user.role !== 'admin') return sendError(res, 403, 'Admin access required');
        const catId = pathname.split('/')[4];
        const existing = db.getCategoryById(catId);
        if (!existing) return sendError(res, 404, 'Category not found');

        const body = await parseBody(req);
        const updates = {};
        if (body.name !== undefined && String(body.name).trim()) {
          updates.name = String(body.name).trim();
        }
        if (body.description !== undefined) {
          updates.description = String(body.description);
        }
        const updated = db.updateCategory(catId, updates);
        if (updates.name) {
          db.getProducts().forEach(p => {
            if (p.categoryId === catId) {
              db.updateProduct(p.id, { categoryName: updates.name });
            }
          });
        }
        return sendJson(res, 200, { success: true, message: 'Category updated.', category: updated });
      }

      if (pathname.match(/^\/api\/admin\/categories\/([^/]+)$/) && method === 'DELETE') {
        if (!user || user.role !== 'admin') return sendError(res, 403, 'Admin access required');
        const catId = pathname.split('/')[4];
        db.deleteCategory(catId);
        return sendJson(res, 200, { success: true, message: 'Category deleted' });
      }

      // ORDERS & PAYMENT GATEWAY
      if (pathname === '/api/orders/place' && method === 'POST') {
        if (!user) return sendError(res, 401, 'Please sign in to order');
        if (user.status !== 'approved') return sendError(res, 403, 'Account pending approval.');

        const body = await parseBody(req);
        const { shippingAddress, paymentDetails, couponCode } = body;
        const requestedItems = body.items;

        if (!Array.isArray(requestedItems) || requestedItems.length === 0) {
          return sendError(res, 400, 'At least one item is required.');
        }

        const validatedItems = [];
        for (const item of requestedItems) {
          const quantity = Number(item.quantity);
          if (!Number.isInteger(quantity) || quantity < 1) {
            return sendError(res, 400, 'Invalid item quantity.');
          }
          const product = db.getProductById(item.productId);
          if (!product || product.stock < quantity) {
            return sendError(res, 400, `Item "${item.name || product?.name || 'Unknown'}" insufficient stock.`);
          }
          validatedItems.push({
            productId: product.id,
            name: product.name,
            price: product.price,
            quantity
          });
        }
        const items = validatedItems;

        const AVAILABLE_COUPONS = {
          'WELCOME10': { type: 'percent', value: 10, minOrder: 0 },
          'FESTIVE20': { type: 'percent', value: 20, minOrder: 0 },
          'FLAT500': { type: 'flat', value: 500, minOrder: 1500 },
          'FREESHIP': { type: 'shipping', value: 99, minOrder: 0 },
          'MEGA50': { type: 'percent', value: 50, minOrder: 0 }
        };

        const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        let shippingFee = subtotal >= 999 ? 0 : 99;
        let discount = 0;
        let validCoupon = null;

        if (couponCode && typeof couponCode === 'string') {
          const cleanCode = couponCode.trim().toUpperCase();
          const found = AVAILABLE_COUPONS[cleanCode];
          if (found && (!found.minOrder || subtotal >= found.minOrder)) {
            validCoupon = cleanCode;
            if (found.type === 'percent') {
              discount = Math.round((subtotal * found.value) / 100);
            } else if (found.type === 'flat') {
              discount = Math.min(found.value, subtotal);
            } else if (found.type === 'shipping') {
              discount = shippingFee;
              shippingFee = 0;
            }
          }
        }

        const discountedSubtotal = Math.max(0, subtotal - (validCoupon && AVAILABLE_COUPONS[validCoupon]?.type === 'shipping' ? 0 : discount));
        const tax = parseFloat((discountedSubtotal * 0.18).toFixed(2));
        const totalAmount = parseFloat((discountedSubtotal + shippingFee + tax).toFixed(2));

        const paymentId = `PAY-${Math.floor(100000 + Math.random() * 900000)}`;
        const gatewayRef = `GW_TXN_${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
        const orderId = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;

        // Decrement stock
        for (const item of items) {
          const p = db.getProductById(item.productId);
          db.updateProduct(item.productId, { stock: p.stock - item.quantity });
        }

        const payment = {
          id: paymentId,
          orderId,
          customerId: user.id,
          customerName: user.name,
          amount: totalAmount,
          discount,
          coupon: validCoupon,
          paymentMethod: `${paymentDetails?.method || 'Credit Card'}${paymentDetails?.cardLast4 ? ` (ending in ${paymentDetails.cardLast4})` : ''}`,
          gatewayRef,
          status: 'success',
          createdAt: new Date().toISOString()
        };
        db.addPayment(payment);

        const order = {
          id: orderId,
          customerId: user.id,
          customerName: user.name,
          customerEmail: user.email,
          items,
          subtotal,
          coupon: validCoupon,
          discount,
          shippingFee,
          tax,
          totalAmount,
          shippingAddress: shippingAddress || {},
          paymentMethod: payment.paymentMethod,
          paymentStatus: 'completed',
          paymentId,
          orderStatus: 'confirmed',
          trackingNumber: `TRK-US-${Math.floor(100000 + Math.random() * 900000)}`,
          deliveryPartner: 'FedEx Priority',
          trackingHistory: [
            { status: 'placed', timestamp: new Date().toISOString(), note: 'Order placed by customer.', location: 'Store' },
            { status: 'confirmed', timestamp: new Date().toISOString(), note: 'Payment confirmed by Gateway.', location: 'Payment Gateway' }
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        db.addOrder(order);

        await sendOrderConfirmationEmail(order, baseUrl);
        return sendJson(res, 201, { success: true, order, payment });
      }

      if (pathname === '/api/orders' && method === 'GET') {
        let orders = [];
        if (user) {
          orders = user.role === 'admin' ? db.getOrders() : db.getOrdersByCustomer(user.id);
        } else {
          return sendError(res, 401, 'Please sign in to view orders');
        }
        return sendJson(res, 200, { orders });
      }

      if (pathname.match(/^\/api\/orders\/([^/]+)$/) && method === 'GET') {
        const order = db.getOrderById(pathname.split('/')[3]);
        if (!order) return sendError(res, 404, 'Order not found');
        if (!user || (user.role !== 'admin' && order.customerId !== user.id)) {
          return sendError(res, 403, 'You do not have access to this order');
        }
        return sendJson(res, 200, { order });
      }

      if (pathname.match(/^\/api\/orders\/([^/]+)\/return$/) && method === 'POST') {
        if (!user) return sendError(res, 401, 'Unauthorized');
        const orderId = pathname.split('/')[3];
        const order = db.getOrderById(orderId);
        if (!order) return sendError(res, 404, 'Order not found');
        if (user.role !== 'admin' && order.customerId !== user.id) {
          return sendError(res, 403, 'You do not have access to this order');
        }
        if (order.returnInfo || order.orderStatus === 'cancelled') {
          return sendError(res, 409, 'A return has already been initiated or the order was cancelled');
        }

        const body = await parseBody(req);
        const returnId = `RET-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
        const returnRecord = {
          returnId,
          orderId: order.id,
          reason: body.reason || 'Defective / performance not as expected',
          resolution: body.resolution || 'refund',
          comments: body.comments || '',
          pickupSlot: body.pickupSlot || 'Tomorrow, 9:00 AM - 1:00 PM',
          pickupAddress: body.pickupAddress || order.shippingAddress,
          refundAmount: order.totalAmount,
          status: 'return_approved',
          requestedAt: new Date().toISOString()
        };

        const updatedHistory = [
          ...order.trackingHistory,
          {
            status: 'return_initiated',
            timestamp: new Date().toISOString(),
            note: `Return #${returnId} requested: ${returnRecord.resolution === 'replace' ? 'Replacement item dispatched' : 'Full refund of ₹' + Number(order.totalAmount || 0).toFixed(2) + ' to be issued upon pickup'}. Reason: ${returnRecord.reason}`,
            location: 'NovaMart Return Center'
          }
        ];

        const updated = db.updateOrder(orderId, {
          orderStatus: 'return_in_progress',
          returnInfo: returnRecord,
          trackingHistory: updatedHistory
        });

        if (returnRecord.resolution === 'refund') {
          await sendRefundConfirmationEmail(updated, {
            amount: updated.totalAmount,
            reason: returnRecord.reason,
            refundId: returnRecord.returnId
          }, baseUrl);
        } else {
          await sendReturnConfirmationEmail(updated, returnRecord, baseUrl);
        }

        return sendJson(res, 200, { success: true, returnRecord, order: updated });
      }

      if (pathname.match(/^\/api\/orders\/([^/]+)\/cancel$/) && method === 'POST') {
        if (!user) return sendError(res, 401, 'Unauthorized');
        const order = db.getOrderById(pathname.split('/')[3]);
        if (!order) return sendError(res, 404, 'Order not found');
        if (user.role !== 'admin' && order.customerId !== user.id) {
          return sendError(res, 403, 'You do not have access to this order');
        }
        if (order.orderStatus === 'cancelled') {
          return sendError(res, 409, 'This order is already cancelled');
        }

        for (const item of order.items) {
          const p = db.getProductById(item.productId);
          if (p) db.updateProduct(item.productId, { stock: p.stock + item.quantity });
        }

        const updated = db.updateOrder(order.id, {
          orderStatus: 'cancelled',
          paymentStatus: 'refunded',
          trackingHistory: [...order.trackingHistory, { status: 'cancelled', timestamp: new Date().toISOString(), note: 'Order cancelled. Refund issued.', location: 'System' }]
        });
        if (order.paymentId) db.updatePayment(order.paymentId, { status: 'refunded' });

        await sendOrderCancellationEmail(updated, baseUrl);
        return sendJson(res, 200, { success: true, message: `Order #${orderId} status updated to ${body.status}.`, order: updated });
      }

      if (pathname.match(/^\/api\/admin\/orders\/([^/]+)\/status$/) && method === 'POST') {
        if (!user || user.role !== 'admin') return sendError(res, 403, 'Admin access required');
        const orderId = pathname.split('/')[4];
        const body = await parseBody(req);
        const order = db.getOrderById(orderId);
        if (!order) return sendError(res, 404, 'Order not found');

        const updateData = {
          orderStatus: body.status,
          trackingHistory: [...order.trackingHistory, { status: body.status, timestamp: new Date().toISOString(), note: body.note || 'Status updated.', location: 'Logistics Center' }]
        };

        if (body.status === 'cancelled') {
          updateData.paymentStatus = 'refunded';
          if (order.paymentId) db.updatePayment(order.paymentId, { status: 'refunded' });
        }

        const updated = db.updateOrder(orderId, updateData);

        if (body.status === 'cancelled') {
          await sendOrderCancellationEmail(updated, baseUrl);
        } else {
          await sendDeliveryStatusUpdateEmail(updated, body.status, body.note, baseUrl);
        }

        return sendJson(res, 200, { success: true, message: `Order #${orderId} status updated to ${body.status}.`, order: updated });
      }

      // PAYMENTS, REVIEWS, REPORTS, EMAILS
      if (pathname === '/api/admin/payments' && method === 'GET') {
        if (!user || user.role !== 'admin') return sendError(res, 403, 'Admin required');
        return sendJson(res, 200, { payments: db.getPayments() });
      }

      if (pathname.match(/^\/api\/admin\/payments\/([^/]+)\/refund$/) && method === 'POST') {
        if (!user || user.role !== 'admin') return sendError(res, 403, 'Admin required');
        const paymentId = pathname.split('/')[4];
        const payment = db.getPaymentById(paymentId);
        if (!payment) return sendError(res, 404, 'Payment not found');
        const updated = db.updatePayment(paymentId, { status: 'refunded' });

        const order = db.getOrders().find(o => o.paymentId === paymentId || o.id === updated?.orderId);
        if (order) {
          await sendRefundConfirmationEmail(order, {
            amount: updated.amount,
            reason: 'Payment refund processed by store administrator',
            refundId: updated.id
          }, baseUrl);
        }

        return sendJson(res, 200, { success: true, payment: updated });
      }

      if (pathname === '/api/reviews' && method === 'GET') {
        return sendJson(res, 200, { reviews: db.getReviews(reqUrl.searchParams.get('productId')) });
      }

      if (pathname === '/api/reviews' && method === 'POST') {
        if (!user) return sendError(res, 401, 'Unauthorized');
        const body = await parseBody(req);
        if (!db.getProductById(body.productId)) {
          return sendError(res, 404, 'Product not found');
        }
        const rating = parseInt(body.rating, 10);
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
          return sendError(res, 400, 'Rating must be between 1 and 5');
        }
        const review = {
          id: `rev_${crypto.randomUUID().slice(0, 8)}`,
          productId: body.productId,
          customerId: user.id,
          customerName: user.name,
          rating,
          comment: body.comment,
          verifiedPurchase: true,
          createdAt: new Date().toISOString()
        };
        db.addReview(review);
        return sendJson(res, 201, { success: true, review });
      }

      if (pathname === '/api/admin/reports' && method === 'GET') {
        if (!user || user.role !== 'admin') return sendError(res, 403, 'Admin required');
        const orders = db.getOrders();
        const users = db.getUsers().filter(u => u.role === 'customer');
        const completed = orders.filter(o => o.orderStatus !== 'cancelled');
        const totalRevenue = completed.reduce((sum, o) => sum + o.totalAmount, 0);

        const categorySales = {};
        db.getCategories().forEach(c => categorySales[c.name] = 0);
        completed.forEach(o => {
          o.items.forEach(i => {
            const prod = db.getProductById(i.productId);
            const cat = prod?.categoryName || 'General';
            categorySales[cat] = (categorySales[cat] || 0) + (i.price * i.quantity);
          });
        });

        return sendJson(res, 200, {
          totalRevenue: parseFloat(totalRevenue.toFixed(2)),
          totalOrders: orders.length,
          completedOrdersCount: completed.length,
          averageOrderValue: completed.length ? parseFloat((totalRevenue / completed.length).toFixed(2)) : 0,
          totalCustomers: users.length,
          pendingCustomers: users.filter(u => u.status === 'pending_approval').length,
          approvedCustomers: users.filter(u => u.status === 'approved').length,
          categorySales,
          topProducts: db.getProducts().slice(0, 4).map(p => ({ ...p, revenue: p.price * 5, unitsSold: 5 }))
        });
      }

      if (pathname === '/api/emails' && method === 'GET') {
        if (!user || user.role !== 'admin') return sendError(res, 403, 'Admin access required');
        return sendJson(res, 200, { emails: db.getEmails() });
      }

      return sendError(res, 404, `Route not found: ${method} ${pathname}`);
    } catch (err) {
      console.error('API Error:', err);
      return sendError(res, 500, err.message);
    }
  }

  // --- LOCAL STATIC ASSETS SERVING ---
  serveStatic(req, res, pathname);
}

// Start standalone HTTP server when executed directly (`node api/index.js` or `npm start`)
const isMainModule = process.argv[1] && process.argv[1].endsWith('index.js');
if (isMainModule && !process.env.VERCEL) {
  const PORT = process.env.PORT || 3000;
  const server = http.createServer(handler);
  server.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`  NovaMart Running at http://localhost:${PORT}`);
    console.log(`  Ready for local development & Vercel deployment!`);
    console.log(`======================================================\n`);
  });
}
