const express = require('express');
const rateLimit = require('express-rate-limit');
const fetch = require('node-fetch');
const nodemailer = require('nodemailer');
const { body, validationResult } = require('express-validator');
require('dotenv').config();
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 4000;
const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET || '';
const RECIPIENT_EMAIL = process.env.RECIPIENT_EMAIL || 'sniyonsenga123@gmail.com';

app.use(cors());
app.use(express.json());

const contactLimiter = rateLimit({ windowMs: 60*1000, max: 6 });

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || '',
  port: parseInt(process.env.SMTP_PORT || '587',10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
});

async function verifyRecaptcha(token) {
  if (!RECAPTCHA_SECRET) return { ok: true };
  const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `secret=${encodeURIComponent(RECAPTCHA_SECRET)}&response=${encodeURIComponent(token)}`
  });
  return res.json();
}

app.post('/api/contact', contactLimiter, [
  body('name').trim().isLength({ min: 2 }),
  body('email').trim().isEmail(),
  body('message').trim().isLength({ min: 5 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ ok: false, errors: errors.array() });

  const { name, email, message, recaptchaToken } = req.body;
  if (recaptchaToken) {
    const rc = await verifyRecaptcha(recaptchaToken).catch(()=>({ success: false }));
    if (!rc.success && rc.score !== undefined) return res.status(403).json({ ok:false, error: 'reCAPTCHA failed' });
  }

  const subject = `Website message from ${name}`;
  const text = `${message}\n\n---\nFrom: ${name}\nEmail: ${email}`;

  if (process.env.SMTP_USER) {
    try {
      await transporter.sendMail({ from: process.env.SMTP_USER, to: RECIPIENT_EMAIL, subject, text, replyTo: email });
      return res.json({ ok: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ ok: false, error: 'Email send failed' });
    }
  }

  console.log('CONTACT (no SMTP):', { name, email, message });
  return res.json({ ok: true, message: 'Received (no SMTP configured)' });
});

app.listen(PORT, ()=> console.log(`Server running on http://localhost:${PORT}`));