/**
 * Retroactive Booking Sync: ElevenLabs → Cal.com
 *
 * Fetches all conversation history from ElevenLabs agents,
 * extracts booking information, and creates bookings in Cal.com.
 *
 * Usage: node scripts/sync-bookings.js
 *
 * Environment variables (or edit constants below):
 *   ELEVENLABS_API_KEY
 *   CAL_API_KEY
 *   CAL_EVENT_TYPE_ID
 */

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || "sk_60954ff158edbce6116609fd360481eff39a0f374843559e";
const CAL_API_KEY = process.env.CAL_API_KEY || "";
const CAL_EVENT_TYPE_ID = parseInt(process.env.CAL_EVENT_TYPE_ID || "5317240", 10);

const AGENT_IDS = [
  "agent_9901knvzexs9fpjbsa4t094gmtby",  // Real Estate
  "agent_4001knwaksf5ef8r40fqmrmr6fk5",  // Dental
];

const ELEVENLABS_BASE = "https://api.elevenlabs.io/v1/convai";
const CAL_BASE = "https://api.cal.com/v2";

// ─── ElevenLabs API ────────────────────────────────────────

async function fetchConversations(agentId, cursor = null) {
  const params = new URLSearchParams({ agent_id: agentId });
  if (cursor) params.set("cursor", cursor);

  const res = await fetch(`${ELEVENLABS_BASE}/conversations?${params}`, {
    headers: { "xi-api-key": ELEVENLABS_API_KEY },
  });
  if (!res.ok) {
    console.error(`Failed to fetch conversations for ${agentId}: ${res.status}`);
    return { conversations: [], has_more: false };
  }
  return res.json();
}

async function fetchConversationDetail(conversationId) {
  const res = await fetch(`${ELEVENLABS_BASE}/conversations/${conversationId}`, {
    headers: { "xi-api-key": ELEVENLABS_API_KEY },
  });
  if (!res.ok) {
    console.error(`Failed to fetch conversation ${conversationId}: ${res.status}`);
    return null;
  }
  return res.json();
}

async function getAllConversations(agentId) {
  const all = [];
  let cursor = null;
  let hasMore = true;

  while (hasMore) {
    const data = await fetchConversations(agentId, cursor);
    if (data.conversations) {
      all.push(...data.conversations);
    }
    hasMore = data.has_more || false;
    cursor = data.next_cursor || null;
  }

  console.log(`  Found ${all.length} conversations for agent ${agentId}`);
  return all;
}

// ─── Booking Extraction ────────────────────────────────────

function extractBookingFromToolCalls(detail) {
  // Check if there are any tool calls that contain booking data
  const toolCalls = detail.analysis?.tool_calls || [];
  const bookings = [];

  for (const call of toolCalls) {
    const name = (call.tool_name || call.name || "").toLowerCase();
    const params = call.parameters || call.arguments || call.params || {};

    // Match tool calls that look like booking requests
    if (name.includes("book") || name.includes("schedule") || name.includes("appointment") || name.includes("create-booking") || name.includes("create_booking")) {
      const booking = {
        name: params.name || params.customer_name || params.full_name || null,
        email: params.email || params.customer_email || null,
        phone: params.phone || params.phone_number || params.contact || null,
        date: params.date || params.start || params.datetime || params.start_time || params.appointment_date || null,
        timeZone: params.timeZone || params.timezone || params.time_zone || "Asia/Manila",
        notes: params.notes || params.reason || params.description || params.service || null,
        source: "elevenlabs_tool_call",
      };

      if (booking.name && booking.date) {
        bookings.push(booking);
      }
    }
  }

  return bookings;
}

function extractBookingFromTranscript(detail) {
  // Try to extract booking info from collected data / data_collection
  const collected = detail.analysis?.data_collection || detail.analysis?.collected_data || {};
  const bookings = [];

  if (Object.keys(collected).length > 0) {
    const name = collected.name || collected.customer_name || collected.full_name || null;
    const email = collected.email || collected.customer_email || null;
    const phone = collected.phone || collected.phone_number || null;
    const date = collected.date || collected.appointment_date || collected.preferred_date || collected.schedule || null;
    const notes = collected.notes || collected.reason || collected.service || collected.treatment || null;

    if (name && date) {
      bookings.push({
        name,
        email,
        phone,
        date,
        timeZone: collected.timezone || "Asia/Manila",
        notes,
        source: "elevenlabs_data_collection",
      });
    }
  }

  return bookings;
}

function extractBookingsFromConversation(detail) {
  const fromTools = extractBookingFromToolCalls(detail);
  const fromData = extractBookingFromTranscript(detail);

  return [...fromTools, ...fromData];
}

// ─── Cal.com API ───────────────────────────────────────────

async function createCalBooking(booking) {
  // Generate a placeholder email if none provided
  const email = booking.email || `${booking.name.replace(/\s+/g, ".").toLowerCase()}@placeholder.kennethcall.ph`;

  // Parse date - try to make it ISO format
  let startDate = booking.date;
  if (startDate && !startDate.includes("T")) {
    startDate = `${startDate}T09:00:00`;
  }

  const payload = {
    eventTypeId: CAL_EVENT_TYPE_ID,
    start: startDate,
    attendee: {
      name: booking.name.substring(0, 200),
      email: email.substring(0, 200),
      timeZone: booking.timeZone || "Asia/Manila",
      language: "en",
    },
    metadata: {
      source: "elevenlabs_retroactive_sync",
      ...(booking.phone && { phone: String(booking.phone).substring(0, 30) }),
      ...(booking.notes && { notes: String(booking.notes).substring(0, 1000) }),
    },
  };

  const res = await fetch(`${CAL_BASE}/bookings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "cal-api-version": "2024-08-13",
      Authorization: `Bearer ${CAL_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error(`  ❌ Failed to create booking: ${data.message || data.error || JSON.stringify(data)}`);
    return null;
  }

  return data;
}

// ─── Main ──────────────────────────────────────────────────

async function main() {
  console.log("=".repeat(60));
  console.log("ElevenLabs → Cal.com Retroactive Booking Sync");
  console.log("=".repeat(60));

  if (!CAL_API_KEY) {
    console.error("\n❌ CAL_API_KEY is required. Set it as environment variable or edit the script.");
    console.log("   Usage: CAL_API_KEY=cal_live_xxx node scripts/sync-bookings.js\n");
    process.exit(1);
  }

  const allBookings = [];

  for (const agentId of AGENT_IDS) {
    console.log(`\n📡 Fetching conversations for agent: ${agentId}`);
    const conversations = await getAllConversations(agentId);

    for (const conv of conversations) {
      const detail = await fetchConversationDetail(conv.conversation_id);
      if (!detail) continue;

      const bookings = extractBookingsFromConversation(detail);
      for (const b of bookings) {
        b.agentId = agentId;
        b.conversationId = conv.conversation_id;
        b.conversationTime = conv.start_time || conv.created_at;
      }
      allBookings.push(...bookings);
    }
  }

  console.log(`\n${"─".repeat(60)}`);
  console.log(`📋 Found ${allBookings.length} booking(s) to sync`);
  console.log(`${"─".repeat(60)}`);

  if (allBookings.length === 0) {
    console.log("\n✅ No bookings found in ElevenLabs conversation history.");
    console.log("   This is normal if agents haven't collected structured booking data yet.");
    console.log("   Future bookings will be created automatically via /api/create-booking.\n");
    return;
  }

  let success = 0;
  let failed = 0;

  for (const booking of allBookings) {
    console.log(`\n📅 Creating booking: ${booking.name} — ${booking.date}`);
    console.log(`   Source: ${booking.source} | Conversation: ${booking.conversationId}`);

    const result = await createCalBooking(booking);
    if (result) {
      console.log(`   ✅ Created: ${result.data?.uid || "ok"}`);
      success++;
    } else {
      failed++;
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`📊 Sync Complete: ${success} created, ${failed} failed, ${allBookings.length} total`);
  console.log(`${"=".repeat(60)}\n`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
