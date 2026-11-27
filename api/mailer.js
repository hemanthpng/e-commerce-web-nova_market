import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import { db } from './db.js';

// Live Email Transport Configuration
const SMTP_USER = process.env.SMTP_USER || 'ishwarspatil2006@gmail.com';
const SMTP_PASS = (process.env.SMTP_PASS || 'towmitrhbjtdfxzn').replace(/\s+/g, '');
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';

let cachedTransporter = null;
function getTransporter() {
  if (cachedTransporter) return cachedTransporter;
  if (SMTP_USER && SMTP_PASS) {
    cachedTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
      }
    });
    return cachedTransporter;
  }
  return null;
}

export async function sendEmail({ to, subject, html, type, recipientName, metadata = {} }) {
  const emailRecord = {
    id: `eml_${crypto.randomUUID().slice(0, 8)}`,
    to,
    subject,
    body: html,
    type,
    recipientName: recipientName || to.split('@')[0],
    status: 'sent',
    metadata,
    sentAt: new Date().toISOString()
  };

  db.addEmail(emailRecord);
  console.log(`[EMAIL DISPATCHED] To: ${to} | Type: ${type} | Subject: ${subject}`);

  const transporter = getTransporter();

  // Dispatch real email via Gmail SMTP if credentials exist
  if (transporter) {
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Gmail SMTP timeout (8000ms)')), 8000)
      );

      const sendPromise = transporter.sendMail({
        from: `"NovaMart" <${SMTP_USER}>`,
        to,
        subject,
        html
      });

      const info = await Promise.race([sendPromise, timeoutPromise]);
      console.log(`[REAL GMAIL DELIVERED] MessageId: ${info.messageId} to ${to}`);
      emailRecord.deliveryInfo = { service: 'gmail_smtp', messageId: info.messageId, delivered: true };
    } catch (err) {
      console.error(`[SMTP ERROR] Could not deliver to ${to}:`, err.message);
      emailRecord.deliveryInfo = { service: 'gmail_smtp', error: err.message, delivered: false };
    }
  } else if (RESEND_API_KEY) {
    // Dispatch via Resend API if API Key is provided
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'NovaMart <onboarding@resend.dev>',
          to: [to],
          subject,
          html
        })
      });
      const data = await res.json();
      console.log(`[REAL RESEND EMAIL DELIVERED] ID: ${data.id} to ${to}`);
      emailRecord.deliveryInfo = { service: 'resend', id: data.id, delivered: true };
    } catch (err) {
      console.error(`[RESEND ERROR] Could not deliver to ${to}:`, err.message);
      emailRecord.deliveryInfo = { service: 'resend', error: err.message, delivered: false };
    }
  }

  return emailRecord;
}

// 1. REGISTRATION EMAIL (Sent to newly registered user + Admin alert)
export async function sendRegistrationPendingEmail(user) {
  const customerHtml = `
    <div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#1e3a8a,#3b82f6);padding:30px 24px;text-align:center;color:#ffffff;">
        <h1 style="margin:0;font-size:22px;font-weight:700;">Account Registration Received</h1>
        <p style="margin:8px 0 0;font-size:14px;opacity:0.9;">Manual Admin Verification in Progress</p>
      </div>
      <div style="padding:28px 24px;color:#334155;line-height:1.6;">
        <p>Hello <strong>${user.name}</strong>,</p>
        <p>Thank you for registering at <strong>NovaMart</strong>! Your registration has been received successfully.</p>
        
        <div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:16px;border-radius:0 8px 8px 0;margin:20px 0;">
          <p style="margin:0;font-size:14px;color:#1e40af;font-weight:700;">Status: WAITING FOR ADMIN APPROVAL</p>
          <p style="margin:6px 0 0;font-size:13px;color:#2563eb;">Registered Email: <strong>${user.email}</strong></p>
          ${user.phone ? `<p style="margin:4px 0 0;font-size:12px;color:#64748b;">Phone: ${user.phone}</p>` : ''}
          ${user.city ? `<p style="margin:4px 0 0;font-size:12px;color:#64748b;">Location: ${user.city}${user.state ? `, ${user.state}` : ''}</p>` : ''}
        </div>

        <p>To ensure trust and security for all buyers and sellers, new customer accounts undergo verification by our store administrator.</p>
        <p>You will receive an approval confirmation email with an instant sign-in link as soon as your account is approved.</p>

        <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;text-align:center;">
          NovaMart India &bull; India's Trusted Online Marketplace &bull; Free Delivery Available
        </div>
      </div>
    </div>
  `;

  // Send confirmation to the newly registered customer
  const customerEmailRecord = await sendEmail({
    to: user.email,
    recipientName: user.name,
    subject: `Registration successful! Waiting for admin approval - NovaMart`,
    type: 'admin_approval_request',
    html: customerHtml,
    metadata: { userId: user.id }
  });

  // Also send an administrative alert to SMTP_USER if different
  if (SMTP_USER && user.email.toLowerCase() !== SMTP_USER.toLowerCase()) {
    const adminAlertHtml = `
      <div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#0f172a,#1e293b);padding:24px 20px;text-align:center;color:#ffffff;">
          <h2 style="margin:0;font-size:20px;color:#38bdf8;">New Customer Registration Pending Review</h2>
          <p style="margin:4px 0 0;font-size:13px;color:#94a3b8;">NovaMart Administrator Notification</p>
        </div>
        <div style="padding:24px;color:#334155;line-height:1.6;">
          <p>Hello Administrator,</p>
          <p>A new customer has just submitted an account registration and is awaiting your review:</p>
          
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:16px 0;font-size:13px;">
            <p style="margin:0 0 6px;"><strong>Customer Name:</strong> ${user.name}</p>
            <p style="margin:0 0 6px;"><strong>Email Address:</strong> <a href="mailto:${user.email}" style="color:#2563eb;">${user.email}</a></p>
            <p style="margin:0 0 6px;"><strong>Phone:</strong> ${user.phone || 'Not provided'}</p>
            <p style="margin:0 0 6px;"><strong>City / State:</strong> ${user.city || 'N/A'}${user.state ? `, ${user.state}` : ''}</p>
            <p style="margin:0;"><strong>Registered At:</strong> ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</p>
          </div>

          <p style="font-size:13px;color:#475569;">
            You can approve or decline this customer from your <strong>Admin Panel &gt; Manage Customers</strong>.
          </p>
        </div>
      </div>
    `;

    await sendEmail({
      to: SMTP_USER,
      recipientName: 'NovaMart Administrator',
      subject: `[Admin Alert] New Customer Registration: ${user.name} (${user.email})`,
      type: 'admin_registration_alert',
      html: adminAlertHtml,
      metadata: { userId: user.id }
    });
  }

  return customerEmailRecord;
}

// 2. ACCOUNT APPROVED EMAIL
export async function sendAccountApprovedEmail(user, baseUrl = '') {
  const loginUrl = `${baseUrl}?login_email=${encodeURIComponent(user.email)}`;
  const html = `
    <div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#065f46,#10b981);padding:30px 24px;text-align:center;color:#ffffff;">
        <h1 style="margin:0;font-size:22px;font-weight:700;">Account Approved by Admin!</h1>
        <p style="margin:8px 0 0;font-size:14px;opacity:0.9;">Your customer profile is now fully verified</p>
      </div>
      <div style="padding:28px 24px;color:#334155;line-height:1.6;">
        <p>Hello <strong>${user.name}</strong>,</p>
        <p>Great news! The store administrator has reviewed and <strong>approved</strong> your customer account.</p>
        
        <div style="background:#ecfdf5;border-left:4px solid #10b981;padding:14px;border-radius:0 8px 8px 0;margin:20px 0;">
          <p style="margin:0;font-size:13px;color:#065f46;font-weight:600;">Status: VERIFIED & ACTIVE</p>
          <p style="margin:4px 0 0;font-size:12px;color:#047857;">Email: <strong>${user.email}</strong></p>
        </div>

        <p>You can now sign in to start shopping, claim discount coupons, and place orders with free express delivery.</p>

        <div style="text-align:center;margin:28px 0;">
          <a href="${loginUrl}" style="background:#10b981;color:#ffffff;text-decoration:none;padding:12px 28px;font-weight:600;font-size:14px;border-radius:6px;display:inline-block;">
            Sign In to Your Account &rarr;
          </a>
        </div>
      </div>
    </div>
  `;

  return await sendEmail({
    to: user.email,
    recipientName: user.name,
    subject: `✓ Your Account Has Been Approved! Welcome to NovaMart`,
    type: 'account_approved',
    html,
    metadata: { userId: user.id }
  });
}

// 3. ORDER CONFIRMATION EMAIL
export async function sendOrderConfirmationEmail(order, baseUrl = '') {
  const itemsHtml = (order.items || []).map(i => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
        <strong>${i.name}</strong><br>
        <span style="font-size:12px;color:#64748b;">Qty: ${i.quantity} &times; ₹${Number(i.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
      </td>
      <td style="padding:10px 0;text-align:right;border-bottom:1px solid #f1f5f9;font-weight:600;">
        ₹${(i.price * i.quantity).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
      </td>
    </tr>
  `).join('');

  const discountRow = order.discount && order.discount > 0 ? `
    <tr>
      <td style="padding:6px 0;color:#16a34a;border-bottom:1px solid #f1f5f9;font-weight:600;">Coupon Savings (${order.coupon || 'PROMO'}):</td>
      <td style="padding:6px 0;color:#16a34a;text-align:right;border-bottom:1px solid #f1f5f9;font-weight:600;">-₹${order.discount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
    </tr>
  ` : '';

  const html = `
    <div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#1e293b,#0f172a);padding:28px 20px;text-align:center;color:#ffffff;">
        <h2 style="margin:0;font-size:22px;color:#f8fafc;">Order Confirmation & Receipt</h2>
        <p style="margin:6px 0 0;font-size:13px;color:#94a3b8;">Order #${order.id} &bull; Payment via ${order.paymentMethod || 'Online Gateway'}</p>
      </div>
      <div style="padding:24px;color:#334155;line-height:1.6;">
        <p>Thank you for your order, <strong>${order.customerName}</strong>! Your payment has been confirmed and your items are being prepared for dispatch.</p>
        
        <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px;">
          <tbody>${itemsHtml}</tbody>
          <tfoot>
            <tr>
              <td style="padding:8px 0 4px;color:#64748b;border-bottom:1px solid #f1f5f9;">Subtotal:</td>
              <td style="padding:8px 0 4px;text-align:right;border-bottom:1px solid #f1f5f9;">₹${Number(order.subtotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>
            ${discountRow}
            <tr>
              <td style="padding:6px 0;color:#64748b;border-bottom:1px solid #f1f5f9;">GST (18%):</td>
              <td style="padding:6px 0;text-align:right;border-bottom:1px solid #f1f5f9;">₹${Number(order.tax || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#64748b;border-bottom:1px solid #f1f5f9;">Delivery Fee:</td>
              <td style="padding:6px 0;text-align:right;border-bottom:1px solid #f1f5f9;">${order.shippingFee === 0 ? '<span style="color:#16a34a;font-weight:600;">FREE</span>' : `₹${Number(order.shippingFee).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}</td>
            </tr>
            <tr>
              <td style="padding-top:12px;font-weight:700;font-size:16px;">Total Paid:</td>
              <td style="padding-top:12px;font-weight:700;font-size:17px;text-align:right;color:#2563eb;">₹${Number(order.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>
          </tfoot>
        </table>

        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;margin:20px 0;font-size:12px;">
          <p style="margin:0 0 4px;font-weight:700;color:#0f172a;">Delivery Information:</p>
          <p style="margin:0;color:#64748b;">Tracking ID: <strong>${order.trackingNumber || 'Assigned upon pickup'}</strong> &bull; Partner: ${order.deliveryPartner || 'FedEx Priority'}</p>
          <p style="margin:4px 0 0;color:#64748b;">Shipping to: ${typeof order.shippingAddress === 'object' ? `${order.shippingAddress.street || ''}, ${order.shippingAddress.city || ''} ${order.shippingAddress.zip || ''}` : (order.shippingAddress || 'Customer Address')}</p>
        </div>

        <div style="text-align:center;margin:24px 0;">
          <a href="${baseUrl}?track_order=${order.id}" style="background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 28px;font-weight:600;font-size:13px;border-radius:6px;display:inline-block;">
            Track Your Shipment Live &rarr;
          </a>
        </div>
      </div>
    </div>
  `;

  // Send receipt to customer
  const customerRecord = await sendEmail({
    to: order.customerEmail,
    recipientName: order.customerName,
    subject: `Order Confirmed: #${order.id} (₹${Number(order.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })})`,
    type: 'order_confirmation',
    html,
    metadata: { orderId: order.id }
  });

  // Also alert store administrator
  if (SMTP_USER && order.customerEmail.toLowerCase() !== SMTP_USER.toLowerCase()) {
    const adminAlertHtml = `
      <div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
        <div style="background:#0f172a;padding:20px;text-align:center;color:#ffffff;">
          <h2 style="margin:0;font-size:18px;color:#38bdf8;">New Customer Order Received!</h2>
          <p style="margin:4px 0 0;font-size:12px;color:#94a3b8;">Order #${order.id} &bull; Total: ₹${Number(order.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
        </div>
        <div style="padding:20px;color:#334155;font-size:13px;line-height:1.6;">
          <p><strong>Customer:</strong> ${order.customerName} (${order.customerEmail})</p>
          <p><strong>Total Amount:</strong> ₹${Number(order.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} (${order.paymentMethod})</p>
          <p><strong>Items:</strong> ${(order.items || []).map(i => `${i.name} (x${i.quantity})`).join(', ')}</p>
          <p style="margin-top:16px;">Open your Admin Command Center to manage fulfillment.</p>
        </div>
      </div>
    `;

    await sendEmail({
      to: SMTP_USER,
      recipientName: 'NovaMart Administrator',
      subject: `[Admin Alert] New Order Received: #${order.id} by ${order.customerName}`,
      type: 'admin_order_alert',
      html: adminAlertHtml,
      metadata: { orderId: order.id }
    });
  }

  return customerRecord;
}

// 4. ORDER CANCELLATION EMAIL
export async function sendOrderCancellationEmail(order, baseUrl = '') {
  const itemsHtml = (order.items || []).map(i => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;">
        <strong>${i.name}</strong> &times; ${i.quantity}
      </td>
      <td style="padding:8px 0;text-align:right;border-bottom:1px solid #f1f5f9;">
        ₹${(i.price * i.quantity).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
      </td>
    </tr>
  `).join('');

  const html = `
    <div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#dc2626,#991b1b);padding:28px 20px;text-align:center;color:#ffffff;">
        <h2 style="margin:0;font-size:20px;">Order Cancellation & Refund Notice</h2>
        <p style="margin:6px 0 0;font-size:13px;color:#fecaca;">Order #${order.id} has been cancelled</p>
      </div>
      <div style="padding:24px;color:#334155;line-height:1.6;">
        <p>Hello <strong>${order.customerName}</strong>,</p>
        <p>Your order <strong>#${order.id}</strong> has been successfully cancelled as requested. A full refund has been initiated.</p>
        
        <div style="background:#fef2f2;border-left:4px solid #ef4444;padding:16px;border-radius:0 8px 8px 0;margin:20px 0;">
          <p style="margin:0;font-size:13px;color:#991b1b;font-weight:700;">Refund Status: INITIATED / PROCESSED</p>
          <p style="margin:6px 0 0;font-size:15px;color:#7f1d1d;">Refund Amount: <strong>₹${Number(order.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></p>
          <p style="margin:4px 0 0;font-size:12px;color:#b91c1c;">Destination: Original Payment Method (${order.paymentMethod || 'Online Gateway'})</p>
          <p style="margin:6px 0 0;font-size:12px;color:#64748b;">Processing timeline: 2-4 business days to reflect on your statement.</p>
        </div>

        <p style="font-weight:600;margin-bottom:8px;font-size:13px;">Cancelled Items:</p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:13px;">
          <tbody>${itemsHtml}</tbody>
          <tfoot>
            <tr>
              <td style="padding-top:10px;font-weight:700;">Total Refund Value:</td>
              <td style="padding-top:10px;font-weight:700;text-align:right;color:#dc2626;font-size:15px;">₹${Number(order.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>
          </tfoot>
        </table>

        <p style="font-size:13px;color:#64748b;">If you have any questions about your cancellation or refund, please reach out to our 24/7 customer support.</p>
      </div>
    </div>
  `;

  return await sendEmail({
    to: order.customerEmail,
    recipientName: order.customerName,
    subject: `Order Cancelled & Refund Initiated: #${order.id} (₹${Number(order.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })})`,
    type: 'order_cancelled',
    html,
    metadata: { orderId: order.id, refundAmount: order.totalAmount }
  });
}

// 5. REFUND CONFIRMATION EMAIL (For Returns & Admin Refunds)
export async function sendRefundConfirmationEmail(order, refundDetails = {}, baseUrl = '') {
  const amount = refundDetails.amount !== undefined ? refundDetails.amount : order.totalAmount;
  const reason = refundDetails.reason || 'Customer Return / Cancellation';
  const refundId = refundDetails.refundId || `REF-${Date.now().toString(36).toUpperCase()}`;

  const html = `
    <div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#059669,#047857);padding:28px 20px;text-align:center;color:#ffffff;">
        <h2 style="margin:0;font-size:20px;color:#ffffff;">✓ Refund Confirmed & Processed</h2>
        <p style="margin:6px 0 0;font-size:13px;color:#a7f3d0;">Reference ID: ${refundId}</p>
      </div>
      <div style="padding:24px;color:#334155;line-height:1.6;">
        <p>Hello <strong>${order.customerName}</strong>,</p>
        <p>We are pleased to inform you that your refund for <strong>Order #${order.id}</strong> has been successfully processed.</p>
        
        <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:16px;margin:18px 0;font-size:13px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
            <span style="color:#64748b;">Refund Amount:</span>
            <strong style="color:#059669;font-size:16px;">₹${Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
            <span style="color:#64748b;">Order Number:</span>
            <strong style="color:#0f172a;">#${order.id}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
            <span style="color:#64748b;">Reason:</span>
            <span style="color:#0f172a;">${reason}</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
            <span style="color:#64748b;">Credited To:</span>
            <strong style="color:#0f172a;">${order.paymentMethod || 'Original Payment Source'}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;">
            <span style="color:#64748b;">Status:</span>
            <strong style="color:#059669;">COMPLETED &amp; CREDITED</strong>
          </div>
        </div>

        <p style="font-size:13px;color:#475569;">
          Depending on your card issuer or bank, the credited funds will appear on your statement within 2-4 business days.
        </p>

        <div style="text-align:center;margin:24px 0;">
          <a href="${baseUrl}?track_order=${order.id}" style="background:#059669;color:#ffffff;text-decoration:none;padding:12px 28px;font-weight:600;font-size:13px;border-radius:6px;display:inline-block;">
            View Order & Refund Status &rarr;
          </a>
        </div>
      </div>
    </div>
  `;

  return await sendEmail({
    to: order.customerEmail,
    recipientName: order.customerName,
    subject: `✓ Refund Confirmed: ₹${Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} for Order #${order.id}`,
    type: 'refund_confirmed',
    html,
    metadata: { orderId: order.id, refundId, amount }
  });
}

// 6. VERIFICATION TOKEN EMAIL
export async function sendVerificationTokenLinkEmail(user, token, baseUrl = '') {
  const verifyUrl = `${baseUrl}?verify_token=${token}`;
  const html = `
    <div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#4f46e5,#6366f1);padding:30px 24px;text-align:center;color:#ffffff;">
        <h1 style="margin:0;font-size:22px;font-weight:700;">Admin Verification Email</h1>
        <p style="margin:8px 0 0;font-size:14px;opacity:0.9;">Complete your account verification</p>
      </div>
      <div style="padding:28px 24px;color:#334155;line-height:1.6;">
        <p>Hello <strong>${user.name}</strong>,</p>
        <p>The administrator has requested that you verify your email address to complete your account activation.</p>
        
        <div style="text-align:center;margin:28px 0;">
          <a href="${verifyUrl}" style="background:#4f46e5;color:#ffffff;text-decoration:none;padding:12px 28px;font-weight:600;font-size:14px;border-radius:6px;display:inline-block;">
            Verify My Email Address &rarr;
          </a>
        </div>

        <p style="font-size:12px;color:#64748b;">Or copy this link:<br>
          <a href="${verifyUrl}" style="color:#4f46e5;word-break:break-all;">${verifyUrl}</a>
        </p>
      </div>
    </div>
  `;

  return await sendEmail({
    to: user.email,
    recipientName: user.name,
    subject: `Action Required: Verify your email address`,
    type: 'verification_link',
    html,
    metadata: { userId: user.id, token }
  });
}

// 7. ACCOUNT REJECTED EMAIL
export async function sendAccountRejectedEmail(user, reason) {
  const html = `
    <div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      <div style="background:#dc2626;padding:26px 20px;text-align:center;color:#ffffff;">
        <h2 style="margin:0;font-size:20px;">Account Verification Update</h2>
      </div>
      <div style="padding:24px;color:#334155;line-height:1.6;">
        <p>Hello <strong>${user.name}</strong>,</p>
        <p>Your account registration could not be approved at this time.</p>
        <div style="background:#fef2f2;border-left:4px solid #ef4444;padding:12px;margin:16px 0;">
          <strong>Reason:</strong> ${reason || 'Incomplete registration details.'}
        </div>
      </div>
    </div>
  `;

  return await sendEmail({
    to: user.email,
    recipientName: user.name,
    subject: `Notice Regarding Your Account Registration`,
    type: 'account_rejected',
    html,
    metadata: { userId: user.id, reason }
  });
}

// 8. DELIVERY UPDATE EMAIL
export async function sendDeliveryStatusUpdateEmail(order, status, note, baseUrl = '') {
  const html = `
    <div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      <div style="background:#2563eb;padding:24px 20px;text-align:center;color:#ffffff;">
        <h2 style="margin:0;font-size:18px;">Delivery Status Update</h2>
        <p style="margin:4px 0 0;font-size:12px;opacity:0.9;">Order #${order.id}</p>
      </div>
      <div style="padding:20px;color:#334155;">
        <p>Hello <strong>${order.customerName}</strong>,</p>
        <p>Your order status has been updated to: <strong>${status.toUpperCase()}</strong></p>
        ${note ? `<p style="font-size:12px;color:#64748b;">Note: ${note}</p>` : ''}
        <div style="text-align:center;margin:20px 0;">
          <a href="${baseUrl}?track_order=${order.id}" style="background:#1e40af;color:#ffffff;text-decoration:none;padding:10px 20px;font-weight:600;font-size:13px;border-radius:6px;display:inline-block;">
            View Tracking Timeline
          </a>
        </div>
      </div>
    </div>
  `;

  return await sendEmail({
    to: order.customerEmail,
    recipientName: order.customerName,
    subject: `Delivery Update: Order #${order.id} is now ${status}`,
    type: 'delivery_update',
    html,
    metadata: { orderId: order.id, status }
  });
}

// 9. RETURN CONFIRMATION EMAIL (For Replacement Pickups)
export async function sendReturnConfirmationEmail(order, returnRecord, baseUrl = '') {
  const isRefund = returnRecord.resolution === 'refund';
  const html = `
    <div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      <div style="background:#24483d;padding:24px 20px;text-align:center;color:#ffffff;border-bottom:3px solid #f05d5e;">
        <h2 style="margin:0;font-size:20px;color:#f2b880;">Return Request Confirmed</h2>
        <p style="margin:4px 0 0;font-size:12px;opacity:0.9;">Return Authorization: ${returnRecord.returnId}</p>
      </div>
      <div style="padding:24px 20px;color:#334155;line-height:1.6;">
        <p>Hello <strong>${order.customerName}</strong>,</p>
        <p>We have received your return request for <strong>Order #${order.id}</strong>. A courier agent has been scheduled for free doorstep pickup.</p>
        
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:16px 0;font-size:13px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
            <span style="color:#64748b;">Return ID:</span>
            <strong style="color:#0f172a;font-family:monospace;">${returnRecord.returnId}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
            <span style="color:#64748b;">Resolution:</span>
            <strong style="color:#0f172a;">${isRefund ? 'Full Refund (₹' + Number(order.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }) + ')' : 'Replacement Item Dispatch'}</strong>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
            <span style="color:#64748b;">Return Reason:</span>
            <span style="color:#0f172a;font-weight:600;">${returnRecord.reason}</span>
          </div>
          <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
            <span style="color:#64748b;">Scheduled Pickup:</span>
            <strong style="color:#0284c7;">${returnRecord.pickupSlot}</strong>
          </div>
          <div style="margin-top:8px;padding-top:8px;border-top:1px dashed #cbd5e1;font-size:12px;color:#64748b;">
            <span>Pickup Address: ${typeof returnRecord.pickupAddress === 'object' ? `${returnRecord.pickupAddress.street || ''}, ${returnRecord.pickupAddress.city || ''} ${returnRecord.pickupAddress.zip || ''}` : returnRecord.pickupAddress}</span>
          </div>
        </div>

        <p style="font-size:13px;color:#475569;">
          <strong>Pickup Instructions:</strong> Please ensure the product is packed with all original tags, accessories, and box. The pickup executive will verify the item upon collection.
        </p>

        <div style="text-align:center;margin:24px 0;">
          <a href="${baseUrl}?track_order=${order.id}" style="background:#f05d5e;color:#0f172a;text-decoration:none;padding:12px 28px;font-weight:700;font-size:13px;border-radius:6px;display:inline-block;box-shadow:0 2px 4px rgba(0,0,0,0.1);">
            Track Return & Pickup Status &rarr;
          </a>
        </div>
      </div>
    </div>
  `;

  return await sendEmail({
    to: order.customerEmail,
    recipientName: order.customerName,
    subject: `Return Confirmed: #${returnRecord.returnId} for Order #${order.id} (${returnRecord.resolution === 'replace' ? 'Replacement' : 'Refund'})`,
    type: 'return_confirmation',
    html,
    metadata: { orderId: order.id, returnId: returnRecord.returnId }
  });
}
