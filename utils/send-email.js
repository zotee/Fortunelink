const nodemailer = require("nodemailer");

const requiredSmtpEnv = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "EMAIL_FROM",
];

const missingSmtpEnv = requiredSmtpEnv.filter(
  (key) => !process.env[key],
);

if (missingSmtpEnv.length > 0) {
  console.warn(
    `Missing SMTP environment variables: ${missingSmtpEnv.join(
      ", ",
    )}`,
  );
}

const smtpPort =
  Number(process.env.SMTP_PORT) || 587;

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: smtpPort,
  secure: smtpPort === 465,

  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendEmail = async ({
  to,
  subject,
  text,
  html,
}) => {
  if (!to) {
    throw new Error(
      "Email recipient is required.",
    );
  }

  return transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    text,
    html,
  });
};

module.exports = sendEmail;