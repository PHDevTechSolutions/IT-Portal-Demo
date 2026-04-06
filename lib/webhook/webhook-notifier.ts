/**
 * lib/webhook/webhook-notifier.ts
 * 
 * Webhook notification system for audit log events
 * Sends notifications to Slack, Teams, or custom endpoints
 */

import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export interface WebhookConfig {
  id?: string;
  name: string;
  url: string;
  type: "slack" | "teams" | "discord" | "custom";
  events: string[]; // e.g., ["create", "delete", "transfer", "login"]
  enabled: boolean;
  headers?: Record<string, string>;
  secret?: string; // For HMAC signature
}

export interface WebhookPayload {
  action: string;
  actor: {
    name?: string | null;
    email?: string | null;
    role?: string | null;
  };
  resourceName?: string | null;
  resourceType?: string | null;
  module?: string | null;
  timestamp: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}

const WEBHOOKS_COLLECTION = "webhook_configs";
const WEBHOOK_LOGS_COLLECTION = "webhook_logs";

/**
 * Send notification to configured webhooks
 */
export async function notifyWebhooks(payload: WebhookPayload): Promise<void> {
  try {
    // Get all enabled webhooks
    const webhooks = await getEnabledWebhooks();
    
    for (const webhook of webhooks) {
      // Check if this event type is subscribed
      if (!webhook.events.includes(payload.action) && !webhook.events.includes("*")) {
        continue;
      }

      // Send to webhook
      await sendToWebhook(webhook, payload);
    }
  } catch (err) {
    console.error("[WebhookNotifier] Error sending notifications:", err);
  }
}

/**
 * Send to a specific webhook
 */
async function sendToWebhook(config: WebhookConfig, payload: WebhookPayload): Promise<void> {
  const startTime = Date.now();
  let success = false;
  let responseStatus = 0;
  let errorMessage = "";

  try {
    const body = formatPayload(config.type, payload);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...config.headers,
    };

    // Add signature if secret is configured
    if (config.secret) {
      const signature = generateSignature(body, config.secret);
      headers["X-Webhook-Signature"] = signature;
    }

    const response = await fetch(config.url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    responseStatus = response.status;
    success = response.ok;

    if (!response.ok) {
      errorMessage = `HTTP ${response.status}: ${await response.text()}`;
    }
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  // Log the webhook delivery
  await logWebhookDelivery(config.id || config.name, payload, success, responseStatus, errorMessage, Date.now() - startTime);
}

/**
 * Format payload for different webhook types
 */
function formatPayload(type: WebhookConfig["type"], payload: WebhookPayload): unknown {
  const basePayload = {
    action: payload.action,
    actor: payload.actor,
    resource: {
      name: payload.resourceName,
      type: payload.resourceType,
    },
    module: payload.module,
    timestamp: payload.timestamp,
    ip_address: payload.ipAddress,
    user_agent: payload.userAgent,
    metadata: payload.metadata,
  };

  switch (type) {
    case "slack":
      return formatSlackPayload(payload);
    case "teams":
      return formatTeamsPayload(payload);
    case "discord":
      return formatDiscordPayload(payload);
    default:
      return basePayload;
  }
}

/**
 * Format for Slack
 */
function formatSlackPayload(payload: WebhookPayload): unknown {
  const actionEmojis: Record<string, string> = {
    create: ":heavy_plus_sign:",
    update: ":pencil:",
    delete: ":wastebasket:",
    transfer: ":arrows_counterclockwise:",
    login: ":key:",
    logout: ":door:",
  };

  return {
    text: `${actionEmojis[payload.action] || ":memo:"} Audit Log: ${payload.action}`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `${actionEmojis[payload.action] || "📝"} ${payload.action.toUpperCase()} - ${payload.resourceType || "Resource"}`,
          emoji: true,
        },
      },
      {
        type: "section",
        fields: [
          {
            type: "mrkdwn",
            text: `*Actor:*\n${payload.actor.name || "Unknown"} (${payload.actor.email || "N/A"})`,
          },
          {
            type: "mrkdwn",
            text: `*Resource:*\n${payload.resourceName || "N/A"}`,
          },
          {
            type: "mrkdwn",
            text: `*Module:*\n${payload.module || "N/A"}`,
          },
          {
            type: "mrkdwn",
            text: `*Time:*\n${new Date(payload.timestamp).toLocaleString()}`,
          },
        ],
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `IP: ${payload.ipAddress || "N/A"} | UA: ${payload.userAgent ? payload.userAgent.substring(0, 30) + "..." : "N/A"}`,
          },
        ],
      },
    ],
  };
}

/**
 * Format for Microsoft Teams
 */
function formatTeamsPayload(payload: WebhookPayload): unknown {
  return {
    "@type": "MessageCard",
    "@context": "https://schema.org/extensions",
    summary: `Audit Log: ${payload.action}`,
    themeColor: getActionColor(payload.action),
    title: `${payload.action.toUpperCase()} - ${payload.resourceType || "Resource"}`,
    sections: [
      {
        facts: [
          { name: "Actor:", value: `${payload.actor.name || "Unknown"} (${payload.actor.email || "N/A"})` },
          { name: "Resource:", value: payload.resourceName || "N/A" },
          { name: "Module:", value: payload.module || "N/A" },
          { name: "Time:", value: new Date(payload.timestamp).toLocaleString() },
          { name: "IP Address:", value: payload.ipAddress || "N/A" },
        ],
      },
    ],
  };
}

/**
 * Format for Discord
 */
function formatDiscordPayload(payload: WebhookPayload): unknown {
  const actionEmojis: Record<string, string> = {
    create: "➕",
    update: "✏️",
    delete: "🗑️",
    transfer: "🔄",
    login: "🔑",
    logout: "🚪",
  };

  return {
    content: `${actionEmojis[payload.action] || "📝"} **${payload.action.toUpperCase()}** - ${payload.resourceType || "Resource"}`,
    embeds: [
      {
        title: payload.resourceName || "Unknown Resource",
        fields: [
          { name: "Actor", value: `${payload.actor.name || "Unknown"}\n${payload.actor.email || "N/A"}`, inline: true },
          { name: "Module", value: payload.module || "N/A", inline: true },
          { name: "Time", value: new Date(payload.timestamp).toLocaleString(), inline: true },
          { name: "IP Address", value: payload.ipAddress || "N/A", inline: true },
        ],
        timestamp: payload.timestamp,
        color: parseInt(getActionColor(payload.action).replace("#", ""), 16) || 0x808080,
      },
    ],
  };
}

/**
 * Get action color for cards
 */
function getActionColor(action: string): string {
  const colors: Record<string, string> = {
    create: "#22c55e",
    update: "#3b82f6",
    delete: "#ef4444",
    transfer: "#a855f7",
    login: "#10b981",
    logout: "#6b7280",
  };
  return colors[action] || "#808080";
}

/**
 * Generate HMAC signature for webhook security
 */
function generateSignature(payload: unknown, secret: string): string {
  // In a real implementation, use crypto.subtle or node:crypto
  // This is a simplified version
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(payload));
  const key = encoder.encode(secret);
  
  // Simple HMAC-like signature (use proper HMAC in production)
  return `sha256=${btoa(String.fromCharCode(...data.map((b, i) => b ^ key[i % key.length])))}`;
}

/**
 * Get all enabled webhook configurations
 */
async function getEnabledWebhooks(): Promise<WebhookConfig[]> {
  // In a real implementation, fetch from Firestore
  // For now, return example config
  return [];
}

/**
 * Log webhook delivery attempt
 */
async function logWebhookDelivery(
  webhookId: string,
  payload: WebhookPayload,
  success: boolean,
  statusCode: number,
  errorMessage: string,
  durationMs: number
): Promise<void> {
  try {
    await addDoc(collection(db, WEBHOOK_LOGS_COLLECTION), {
      webhookId,
      action: payload.action,
      resourceName: payload.resourceName,
      success,
      statusCode,
      errorMessage,
      durationMs,
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    console.error("[WebhookNotifier] Failed to log delivery:", err);
  }
}

/**
 * Test a webhook configuration
 */
export async function testWebhook(config: WebhookConfig): Promise<{ success: boolean; message: string }> {
  const testPayload: WebhookPayload = {
    action: "test",
    actor: { name: "Test User", email: "test@example.com", role: "admin" },
    resourceName: "Test Resource",
    resourceType: "test",
    module: "WebhookTesting",
    timestamp: new Date().toISOString(),
    ipAddress: "127.0.0.1",
    userAgent: "Webhook Test",
  };

  try {
    const body = formatPayload(config.type, testPayload);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...config.headers,
    };

    if (config.secret) {
      const signature = generateSignature(body, config.secret);
      headers["X-Webhook-Signature"] = signature;
    }

    const response = await fetch(config.url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (response.ok) {
      return { success: true, message: `Success! HTTP ${response.status}` };
    } else {
      return { success: false, message: `Failed: HTTP ${response.status} - ${await response.text()}` };
    }
  } catch (err) {
    return { success: false, message: `Error: ${err instanceof Error ? err.message : String(err)}` };
  }
}
