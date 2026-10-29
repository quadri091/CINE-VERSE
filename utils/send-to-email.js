const fs = require("fs");
const path = require("path");
const nodemailer = require("nodemailer");
require("dotenv").config();

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.email,
    pass: process.env.password,
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 20000,
});

const sendMail = async (mailOptions) => {
  if (!process.env.BREVO_API_KEY) {
    return transporter.sendMail(mailOptions);
  }

  const request = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: "Cine Verse", email: process.env.email },
      to: [{ email: mailOptions.to }],
      replyTo: mailOptions.replyTo ? { email: mailOptions.replyTo } : undefined,
      subject: mailOptions.subject,
      htmlContent: mailOptions.html,
    }),
  });

  if (!request.ok) {
    throw new Error(`Brevo ${request.status}: ${await request.text()}`);
  }
  return request.json();
};

const LOGO_SRC = `${process.env.SERVER_URL || `http://localhost:${process.env.PORT || 8000}`}/static/logo.png`;

const C = {
  green: "#4CAF50",
  greenDark: "#23B656",
  greenSoft: "#E8F5E9",
  greenText: "#2E7D32",
  ink: "#111A14",
  muted: "#6E7171",
  border: "#E0E0E0",
  page: "#F4F7F4",
  panel: "#F7FAF7",
};

const buildTemplate = ({
  eyebrow,
  heading,
  intro,
  greeting,
  detailsLabel,
  detailValue,
  detailSub,
  badge,
  code,
  message,
  noteTitle,
  noteItems,
  noteTone = "default",
}) => {
  const noteColors =
    noteTone === "danger"
      ? { bg: "#FDF2F2", border: "#F3CACA", title: "#B42318" }
      : { bg: C.greenSoft, border: "#A5D6A7", title: C.greenText };

  const digitBoxes = String(code || "")
    .split("")
    .map(
      (digit) => `
        <td style="padding:0 4px;">
          <div style="width:44px;height:56px;line-height:56px;text-align:center;border:1.5px solid ${C.border};border-radius:14px;background-color:#FFFFFF;font-size:26px;font-weight:700;color:${C.ink};font-family:'Courier New',monospace;">${digit}</div>
        </td>`,
    )
    .join("");

  const noteListHtml = noteItems
    .map(
      (item) => `<li style="margin:0 0 6px 0;color:${C.muted};">${item}</li>`,
    )
    .join("");

  const badgeHtml = badge
    ? `<span style="display:inline-block;margin-top:10px;padding:4px 12px;background-color:${C.greenSoft};border-radius:15px;color:${C.greenText};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;">${badge}</span>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Cine Verse - ${heading}</title>
  </head>
  <body style="margin:0;padding:0;background-color:${C.page};font-family:'Inter','Helvetica Neue',Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:${C.page};">
      <tr>
        <td align="center" style="padding:32px 12px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;">

            <!-- Header: green gradient, like the login screen -->
            <tr>
              <td style="background-color:${C.green};background-image:linear-gradient(135deg,${C.greenDark} 0%,${C.green} 100%);border-radius:24px 24px 0 0;padding:32px 32px 36px 32px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td align="left">
                      <table role="presentation" cellspacing="0" cellpadding="0">
                        <tr>
                          <td style="width:64px;height:64px;background-color:#FFFFFF;border-radius:32px;text-align:center;vertical-align:middle;">
                            <img src="${LOGO_SRC}" width="44" height="44" alt="Cine Verse" style="display:block;margin:10px auto;border:0;" />
                          </td>
                          <td style="padding-left:12px;font-size:18px;font-weight:700;color:#FFFFFF;letter-spacing:-0.2px;">Cine Verse</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-top:28px;">
                      <p style="margin:0 0 8px 0;color:${C.greenSoft};font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:2px;">${eyebrow}</p>
                      <h1 style="margin:0;color:#FFFFFF;font-size:30px;line-height:1.1;font-weight:700;letter-spacing:-0.5px;">${heading}</h1>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Card body -->
            <tr>
              <td style="background-color:#FFFFFF;border-radius:0 0 24px 24px;padding:32px;">

                <p style="margin:0 0 6px 0;color:${C.ink};font-size:17px;font-weight:600;">${greeting}</p>
                <p style="margin:0 0 28px 0;color:${C.muted};font-size:15px;line-height:23px;">${intro}</p>

                ${
                  code
                    ? `<!-- Code -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td align="center">
                      <table role="presentation" cellspacing="0" cellpadding="0">
                        <tr>${digitBoxes}</tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding-top:16px;color:${C.muted};font-size:13px;">
                      Expires in <strong style="color:${C.green};">10 minutes</strong>
                    </td>
                  </tr>
                </table>`
                    : `<!-- Message -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="background-color:${C.panel};border-left:4px solid ${C.green};border-radius:12px;padding:16px 18px;color:${C.ink};font-size:15px;line-height:23px;white-space:pre-wrap;">${message || ""}</td>
                  </tr>
                </table>`
                }

                <!-- Account details, styled like the app's input boxes -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:28px;">
                  <tr>
                    <td style="background-color:${C.panel};border:1px solid ${C.border};border-radius:16px;padding:16px 18px;">
                      <p style="margin:0;color:${C.muted};font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;">${detailsLabel}</p>
                      <p style="margin:6px 0 2px 0;color:${C.ink};font-size:16px;font-weight:700;">${detailValue}</p>
                      <p style="margin:0;color:${C.muted};font-size:14px;">${detailSub}</p>
                      ${badgeHtml}
                    </td>
                  </tr>
                </table>

                <!-- Security note -->
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:16px;">
                  <tr>
                    <td style="background-color:${noteColors.bg};border:1px solid ${noteColors.border};border-radius:16px;padding:16px 18px;">
                      <p style="margin:0 0 8px 0;color:${noteColors.title};font-size:14px;font-weight:700;">${noteTitle}</p>
                      <ul style="margin:0;padding-left:18px;font-size:13px;line-height:21px;">
                        ${noteListHtml}
                      </ul>
                    </td>
                  </tr>
                </table>

              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:24px 16px 0 16px;text-align:center;">
                <p style="margin:0 0 8px 0;color:${C.muted};font-size:12px;line-height:18px;">
                  This email was sent from Cine Verse. If you have questions, contact our support team.
                </p>
                <p style="margin:0 0 12px 0;color:#A0A8A0;font-size:12px;">© 2026 Cine Verse. All rights reserved.</p>
                <span style="color:${C.muted};font-size:11px;">Help Center</span>
                <span style="color:${C.border};font-size:11px;">&nbsp;|&nbsp;</span>
                <span style="color:${C.muted};font-size:11px;">Privacy Policy</span>
                <span style="color:${C.border};font-size:11px;">&nbsp;|&nbsp;</span>
                <span style="color:${C.muted};font-size:11px;">Terms</span>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};

const sendEmail = async (email, code, username) => {
  const html = buildTemplate({
    eyebrow: "Account Verification",
    heading: "Verify Your Account",
    intro: "Use the verification code below to complete your sign-in.",
    greeting: `Hi ${username},`,
    detailsLabel: "Account Details",
    detailValue: username,
    detailSub: email,
    code,
    noteTitle: "Security Tips",
    noteItems: [
      "Never share this code with anyone",
      "Cine Verse staff will never ask for this code",
      "If you didn't request this code, please ignore this email",
    ],
  });

  try {
    await sendMail({
      from: process.env.email,
      to: email,
      subject: "Your Cine Verse verification code",
      html,
    });
    return { success: true, text: "Mail sent" };
  } catch (error) {
    console.error("Nodemailer error: ", error);
    return { success: false, text: "Failed to send mail" };
  }
};

const sendForgotPasswordEmail = async (email, code, username) => {
  const html = buildTemplate({
    eyebrow: "Password Reset",
    heading: "Reset Your Password",
    intro:
      "We received a request to reset your password. Use the code below to create a new one.",
    greeting: `Hi ${username},`,
    detailsLabel: "Account Details",
    detailValue: username,
    detailSub: email,
    code,
    noteTitle: "Didn't request this?",
    noteItems: [
      "Never share this code with anyone",
      "Cine Verse will never ask for your password",
      "If you didn't request this, you can safely ignore this email",
    ],
    noteTone: "danger",
  });

  try {
    await sendMail({
      from: process.env.email,
      to: email,
      subject: "Reset your Cine Verse password",
      html,
    });
    return { success: true, text: "Mail sent", status: "success" };
  } catch (error) {
    console.log(error);
    return { success: false, text: "Failed to send mail", status: "fail" };
  }
};

const sendAdminEmail = async (email, code, username, role) => {
  const html = buildTemplate({
    eyebrow: "Staff Portal",
    heading: "Verify Your Staff Account",
    intro: `A staff account request was submitted for the role of <strong style="color:${C.ink};">${role}</strong>. Use the code below to confirm this account.`,
    greeting: `Hi ${username},`,
    detailsLabel: "Staff Account Details",
    detailValue: username,
    detailSub: email,
    badge: `Requested as ${role}`,
    code,
    noteTitle: "Security Tips",
    noteItems: [
      "Never share this code with anyone",
      "Cine Verse staff will never ask for this code",
      "Staff-level access grants administrative privileges. Confirm this request came from you",
      "If you didn't request this code, please ignore this email",
    ],
  });

  try {
    await sendMail({
      from: process.env.email,
      to: email,
      subject: "Verify your Cine Verse staff account",
      html,
    });
    return { success: true, text: "Mail sent", status: "success" };
  } catch (error) {
    console.log(error);
    return { success: false, text: "Failed to send mail", status: "fail" };
  }
};

const changeEmail = async (email, code, username) => {
  const html = buildTemplate({
    eyebrow: "Email Change",
    heading: "Confirm Your New Email",
    intro:
      "We received a request to change the email address on your account. Enter the code below to confirm this change.",
    greeting: `Hi ${username},`,
    detailsLabel: "New Email",
    detailValue: email,
    detailSub: "This will become your sign-in email",
    code,
    noteTitle: "Didn't request this?",
    noteItems: [
      "Never share this code with anyone",
      "Cine Verse staff will never ask for this code",
      "If you didn't request an email change, secure your account and contact support immediately",
    ],
    noteTone: "danger",
  });

  try {
    await sendMail({
      from: process.env.email,
      to: email,
      subject: "Confirm your new Cine Verse email",
      html,
    });
    return { success: true, text: "Mail sent", status: "success" };
  } catch (error) {
    console.log(error);
    return { success: false, text: "Failed to send mail", status: "fail" };
  }
};

const clean = (text) =>
  String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const trySend = async (mailOptions) => {
  try {
    await sendMail(mailOptions);
    return { success: true, text: "Mail sent" };
  } catch (error) {
    console.error("Mail error: ", error);
    return { success: false, text: "Failed to send mail" };
  }
};

const sendSupportEmail = async (user, text) => {
  const html = buildTemplate({
    eyebrow: "Help & Support",
    heading: "New Support Message",
    intro: "A user sent this from the Cine Verse app. Reply to this email to answer them.",
    greeting: "Hi Support Team,",
    detailsLabel: "From",
    detailValue: clean(user.userName),
    detailSub: clean(user.email),
    message: clean(text),
    noteTitle: "Next steps",
    noteItems: [
      "Reply to this email to answer the user directly",
      "Or reply from the admin Support tab in the app",
    ],
  });
  return trySend({
    from: process.env.email,
    to: process.env.SUPPORT_EMAIL || process.env.email,
    replyTo: user.email,
    subject: `Support: ${user.userName}`,
    html,
  });
};

const sendSupportReceipt = async (user, text) => {
  const html = buildTemplate({
    eyebrow: "Help & Support",
    heading: "We Got Your Message",
    intro: "Thanks for reaching out. Our team will reply to this email soon.",
    greeting: `Hi ${clean(user.userName)},`,
    detailsLabel: "Account Details",
    detailValue: clean(user.userName),
    detailSub: clean(user.email),
    message: clean(text),
    noteTitle: "Good to know",
    noteItems: [
      "Cine Verse will never ask for your password",
      "Keep your ticket codes private",
    ],
  });
  return trySend({
    from: process.env.email,
    to: user.email,
    subject: "We got your message",
    html,
  });
};

const sendSupportReply = async (user, question, reply) => {
  const html = buildTemplate({
    eyebrow: "Help & Support",
    heading: "Reply From Cine Verse",
    intro: `You asked: "${clean(question)}"`,
    greeting: `Hi ${clean(user.userName)},`,
    detailsLabel: "Account Details",
    detailValue: clean(user.userName),
    detailSub: clean(user.email),
    message: clean(reply),
    noteTitle: "Need more help?",
    noteItems: ["Reply to this email or send another message from the app"],
  });
  return trySend({
    from: process.env.email,
    to: user.email,
    replyTo: process.env.SUPPORT_EMAIL || process.env.email,
    subject: "Reply from Cine Verse support",
    html,
  });
};

module.exports = {
  sendSupportEmail,
  sendSupportReceipt,
  sendSupportReply,
  sendEmail,
  changeEmail,
  sendAdminEmail,
  sendForgotPasswordEmail,
};
