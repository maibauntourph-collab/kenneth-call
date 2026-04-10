/**
 * Cal.com Booking Creation API
 * Called by ElevenLabs voice agents when a user wants to book an appointment.
 *
 * Environment variables required:
 *   CAL_API_KEY      — Cal.com API key (from cal.com/settings/developer/api-keys)
 *   CAL_EVENT_TYPE_ID — Event type ID for appointment bookings
 *
 * Expected POST body:
 *   { name, email, phone?, date, timeZone?, notes? }
 *
 * Example: POST /api/create-booking
 *   { "name": "Juan Cruz", "email": "juan@example.com", "date": "2026-04-15T10:00:00", "timeZone": "Asia/Manila" }
 */

const ALLOWED_ORIGINS = [
  "https://elevenlabs.io",
  "https://api.elevenlabs.io",
];

export async function onRequestPost(context) {
  const origin = context.request.headers.get("Origin") || "";
  const corsHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  try {
    const { CAL_API_KEY, CAL_EVENT_TYPE_ID } = context.env;

    if (!CAL_API_KEY || !CAL_EVENT_TYPE_ID) {
      return new Response(
        JSON.stringify({ error: "Server configuration missing: CAL_API_KEY or CAL_EVENT_TYPE_ID" }),
        { status: 500, headers: corsHeaders }
      );
    }

    const body = await context.request.json();
    const { name, email, phone, date, timeZone, notes } = body;

    // Validate required fields
    if (!name || !email || !date) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: name, email, date" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Build Cal.com API v2 booking request
    const calPayload = {
      eventTypeId: parseInt(CAL_EVENT_TYPE_ID, 10),
      start: date,
      attendee: {
        name: name.substring(0, 200),
        email: email.substring(0, 200),
        timeZone: timeZone || "Asia/Manila",
        language: "en",
      },
      metadata: {},
    };

    if (phone) {
      calPayload.metadata.phone = String(phone).substring(0, 30);
    }
    if (notes) {
      calPayload.metadata.notes = String(notes).substring(0, 1000);
    }

    const calResponse = await fetch("https://api.cal.com/v2/bookings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "cal-api-version": "2024-08-13",
        Authorization: `Bearer ${CAL_API_KEY}`,
      },
      body: JSON.stringify(calPayload),
    });

    const calData = await calResponse.json();

    if (!calResponse.ok) {
      console.error("[CREATE-BOOKING] Cal.com error:", JSON.stringify(calData));
      return new Response(
        JSON.stringify({
          error: "Failed to create booking in Cal.com",
          details: calData.message || calData.error || "Unknown error",
        }),
        { status: calResponse.status, headers: corsHeaders }
      );
    }

    console.log(`[CREATE-BOOKING] ✅ Booking created: ${calData.data?.uid || "unknown"}`);

    return new Response(
      JSON.stringify({
        status: "ok",
        message: "Booking created successfully",
        bookingId: calData.data?.uid,
        startTime: calData.data?.startTime,
        endTime: calData.data?.endTime,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    console.error("[CREATE-BOOKING] Error:", err.message);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: corsHeaders }
    );
  }
}

// Handle CORS preflight
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}
