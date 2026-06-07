// supabase/functions/send-email/index.ts
// SkyVayu — Supabase Edge Function for sending transactional emails
// Deploy: supabase functions deploy send-email
// All 5 email types: new_query_assigned | booking_confirmed | operator_approved | operator_rejected | employee_welcome

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM_EMAIL = "SkyVayu <noreply@skyvayu.com>";
const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL") ?? "anandswati01@gmail.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── HTML wrapper ──────────────────────────────────────────────
function wrap(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { margin:0; padding:0; background:#0c1324; font-family:'DM Sans',Arial,sans-serif; color:#fff; }
    .container { max-width:560px; margin:40px auto; background:#0f1a30; border-radius:12px; overflow:hidden; border:1px solid rgba(255,255,255,0.08); }
    .header { background:linear-gradient(135deg,#0c1324 0%,#162040 100%); padding:32px 40px; border-bottom:1px solid rgba(251,191,36,0.3); }
    .logo { font-size:28px; font-style:italic; color:#fbbf24; letter-spacing:-0.5px; }
    .body { padding:32px 40px; }
    h2 { margin:0 0 16px; font-size:20px; font-weight:500; color:#fff; }
    p { margin:0 0 14px; font-size:14px; line-height:1.6; color:rgba(255,255,255,0.75); }
    .detail-row { display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid rgba(255,255,255,0.06); font-size:13px; }
    .detail-label { color:rgba(255,255,255,0.45); }
    .detail-value { color:#fff; font-weight:500; }
    .btn { display:inline-block; margin-top:24px; padding:12px 28px; background:#fbbf24; color:#0c1324; border-radius:6px; font-weight:600; font-size:14px; text-decoration:none; }
    .badge { display:inline-block; padding:4px 12px; border-radius:20px; font-size:11px; font-weight:600; letter-spacing:1px; text-transform:uppercase; }
    .badge-green { background:rgba(34,197,94,0.15); color:#22c55e; border:1px solid rgba(34,197,94,0.3); }
    .badge-red { background:rgba(239,68,68,0.15); color:#ef4444; border:1px solid rgba(239,68,68,0.3); }
    .badge-gold { background:rgba(251,191,36,0.15); color:#fbbf24; border:1px solid rgba(251,191,36,0.3); }
    .footer { padding:20px 40px; background:#0c1324; border-top:1px solid rgba(255,255,255,0.06); font-size:12px; color:rgba(255,255,255,0.3); text-align:center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><div class="logo">SkyVayu</div></div>
    <div class="body">${body}</div>
    <div class="footer">SkyVayu Private Charter &bull; This is an automated email, please do not reply.</div>
  </div>
</body>
</html>`;
}

// ── Email templates ───────────────────────────────────────────
function getTemplate(type: string, p: Record<string, string>) {
  switch (type) {

    // 1. Sent to operator when a new query is assigned
    case "new_query_assigned":
      return {
        to: p.operator_email || ADMIN_EMAIL,
        subject: "New Charter Request — Action Required",
        html: wrap("New Charter Request", `
          <h2>New booking request assigned to you</h2>
          <p>A new charter inquiry has been submitted on SkyVayu. Please log in to the operator portal to review and submit your quote within 60 minutes.</p>
          <div class="detail-row"><span class="detail-label">Query ID</span><span class="detail-value">${p.query_id || "—"}</span></div>
          <a class="btn" href="https://charter-v2.vercel.app/operator">View in Operator Portal →</a>
        `),
      };

    // 2. Sent to customer when booking is confirmed
    case "booking_confirmed":
      return {
        to: p.client_email || ADMIN_EMAIL,
        subject: `Booking Confirmed — ${p.booking_ref || "SkyVayu"}`,
        html: wrap("Booking Confirmed", `
          <h2>Your booking is confirmed ✓</h2>
          <p>Thank you for choosing SkyVayu. Here are your booking details:</p>
          <div class="detail-row"><span class="detail-label">Booking Ref</span><span class="detail-value">${p.booking_ref || "—"}</span></div>
          <div class="detail-row"><span class="detail-label">Route</span><span class="detail-value">${p.route || "—"}</span></div>
          <div class="detail-row"><span class="detail-label">Date</span><span class="detail-value">${p.date || "—"}</span></div>
          <div class="detail-row"><span class="detail-label">Aircraft</span><span class="detail-value">${p.aircraft || "—"}</span></div>
          <div class="detail-row"><span class="detail-label">Operator</span><span class="detail-value">${p.operator_name || "—"}</span></div>
          <div class="detail-row"><span class="detail-label">Passengers</span><span class="detail-value">${p.passengers || "—"}</span></div>
          <div class="detail-row"><span class="detail-label">Total Amount</span><span class="detail-value">${p.total_amount || "—"}</span></div>
          <p style="margin-top:20px;">Our team will be in touch with final logistics. Safe travels!</p>
          <a class="btn" href="https://charter-v2.vercel.app/profile">View My Bookings →</a>
        `),
      };

    // 3. Sent to operator when admin approves their account
    case "operator_approved":
      return {
        to: p.operator_email || ADMIN_EMAIL,
        subject: "Your SkyVayu Operator Account is Approved",
        html: wrap("Operator Approved", `
          <h2>Welcome to SkyVayu Operators <span class="badge badge-green">Approved</span></h2>
          <p>Congratulations! Your operator account has been approved by the SkyVayu admin team. You can now log in to the operator portal to start receiving and quoting on charter requests.</p>
          ${p.operator_name ? `<div class="detail-row"><span class="detail-label">Operator Name</span><span class="detail-value">${p.operator_name}</span></div>` : ""}
          <a class="btn" href="https://charter-v2.vercel.app/operator">Go to Operator Portal →</a>
        `),
      };

    // 4. Sent to operator when admin rejects their account
    case "operator_rejected":
      return {
        to: p.operator_email || ADMIN_EMAIL,
        subject: "SkyVayu Operator Application — Update",
        html: wrap("Application Update", `
          <h2>Application Status <span class="badge badge-red">Not Approved</span></h2>
          <p>Thank you for your interest in becoming a SkyVayu operator. Unfortunately, we are unable to approve your application at this time.</p>
          ${p.reason ? `<div class="detail-row"><span class="detail-label">Reason</span><span class="detail-value">${p.reason}</span></div>` : ""}
          <p>If you believe this is an error or have additional information to provide, please contact us at <a href="mailto:${ADMIN_EMAIL}" style="color:#fbbf24;">${ADMIN_EMAIL}</a>.</p>
        `),
      };

    // 5. Sent to a new internal team member / employee
    case "employee_welcome":
      return {
        to: p.employee_email || ADMIN_EMAIL,
        subject: "Welcome to the SkyVayu Team",
        html: wrap("Welcome to SkyVayu", `
          <h2>Welcome aboard, ${p.employee_name || "Team Member"}!</h2>
          <p>You've been added to the SkyVayu team. Here are your onboarding details:</p>
          ${p.role ? `<div class="detail-row"><span class="detail-label">Role</span><span class="detail-value">${p.role}</span></div>` : ""}
          ${p.login_email ? `<div class="detail-row"><span class="detail-label">Login Email</span><span class="detail-value">${p.login_email}</span></div>` : ""}
          <p style="margin-top:16px;">Please log in to the admin panel and change your password on first login.</p>
          <a class="btn" href="https://charter-v2.vercel.app/admin">Go to Admin Panel →</a>
        `),
      };

    default:
      return null;
  }
}

// ── Handler ───────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { type, ...payload } = body;

    if (!type) {
      return new Response(JSON.stringify({ error: "Missing email type" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const template = getTemplate(type, payload);
    if (!template) {
      return new Response(JSON.stringify({ error: `Unknown email type: ${type}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!RESEND_API_KEY) {
      console.warn("RESEND_API_KEY not set — email not sent for type:", type);
      return new Response(JSON.stringify({ warning: "RESEND_API_KEY not configured", type }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [template.to],
        subject: template.subject,
        html: template.html,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Resend error:", data);
      return new Response(JSON.stringify({ error: "Email send failed", details: data }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, id: data.id, type }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("send-email function error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
