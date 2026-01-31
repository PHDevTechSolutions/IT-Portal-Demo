// pages/api/login.ts
import { NextApiRequest, NextApiResponse } from "next";
import { validateUser, connectToDatabase } from "@/lib/MongoDB";
import { serialize } from "cookie";
import nodemailer from "nodemailer";
import { UAParser } from "ua-parser-js";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { Email, Password, deviceId } = req.body;
  if (!Email || !Password || !deviceId) {
    return res.status(400).json({ message: "Email, Password and deviceId are required." });
  }

  const db = await connectToDatabase();
  const users = db.collection("users");
  const securityAlerts = db.collection("security_alerts"); // Collection for alerts

  const user = await users.findOne({ Email });
  if (!user) {
    return res.status(401).json({ message: "Invalid credentials." });
  }

  // ❌ Resigned / Terminated
  if (["Resigned", "Terminated"].includes(user.Status)) {
    return res.status(403).json({
      message: `Your account is ${user.Status}. Login not allowed.`,
    });
  }

  // 🔒 Already locked
  if (user.Status === "Locked") {
    return res.status(403).json({
      message: "Account Is Locked. Submit your ticket to IT Department.",
      locked: true,
    });
  }

  const result = await validateUser({ Email, Password });

  // Get User-Agent
  const userAgent = req.headers["user-agent"] || "Unknown";
  const parser = new UAParser(userAgent);
  const deviceType = parser.getDevice().type || "desktop";

  // ❌ INVALID PASSWORD
  if (!result.success) {
    const attempts = (user.LoginAttempts || 0) + 1;

    // ✅ Send security alert email and log to DB after 2 failed attempts
    if (attempts === 2) {
      const ip =
        req.headers["x-forwarded-for"]?.toString().split(",")[0] ||
        req.socket.remoteAddress ||
        "Unknown IP";

      const timestamp = new Date();

      // Log to DB
      try {
        await securityAlerts.insertOne({
          Email,
          ipAddress: ip,
          deviceId,
          userAgent,
          deviceType,
          timestamp,
          message: `2 failed login attempts detected for account ${Email}`,
        });
      } catch (err) {
        console.error("Failed to log security alert in DB", err);
      }

      // Send email
      try {
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          },
        });

        await transporter.sendMail({
          from: `"Taskflow Security" <${process.env.EMAIL_USER}>`,
          to: Email,
          subject: `Security Alert: Failed login attempts on your account`,
          html: `
            <p>There have been <strong>2 failed login attempts</strong> on your account <strong>${Email}</strong>.</p>
            <ul>
              <li><strong>IP Address:</strong> ${ip}</li>
              <li><strong>Device ID:</strong> ${deviceId}</li>
              <li><strong>Device Type:</strong> ${deviceType}</li>
              <li><strong>Time:</strong> ${timestamp.toLocaleString("en-US", { timeZone: "Asia/Manila" })}</li>
            </ul>
            <p>If this was you, you can disregard this email.</p>
            <p>If not, please consider changing your password immediately.</p>
          `,
        });
      } catch (err) {
        console.error("Failed to send security alert email", err);
      }
    }

    // Lock account after 5 failed attempts
    if (attempts >= 5) {
      await users.updateOne(
        { Email },
        { $set: { LoginAttempts: attempts, Status: "Locked", LockUntil: null } }
      );

      return res.status(403).json({
        message: "Account Is Locked. Submit your ticket to IT Department.",
        locked: true,
      });
    }

    // Update attempts in DB
    await users.updateOne({ Email }, { $set: { LoginAttempts: attempts } });

    return res.status(401).json({
      message: `Invalid credentials. Attempt ${attempts}/5`,
    });
  }

  // ❗ SALES & IT ONLY
  if (user.Department !== "Sales" && user.Department !== "IT") {
    return res.status(403).json({
      message: "Only Sales or IT department users are allowed to log in.",
    });
  }


  // ✅ RESET AFTER SUCCESS and save deviceId
  await users.updateOne(
    { Email },
    {
      $set: {
        LoginAttempts: 0,
        Status: "Active",
        LockUntil: null,
        DeviceId: deviceId,
      },
    }
  );

  const userId = result.user._id.toString();

  res.setHeader(
    "Set-Cookie",
    serialize("session", userId, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== "development",
      sameSite: "strict",
      maxAge: 60 * 60 * 24, // 1 day
      path: "/",
    })
  );

  return res.status(200).json({
    message: "Login successful",
    userId,
    Role: user.Role,
    Department: user.Department,
    Status: user.Status,
    ReferenceID: user.ReferenceID,

  });
}
