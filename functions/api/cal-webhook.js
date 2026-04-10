export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const triggerEvent = body.triggerEvent || "unknown";
    const payload = body.payload || {};

    console.log(`[CAL WEBHOOK] ${triggerEvent}`);

    switch (triggerEvent) {
      case "BOOKING_CREATED": {
        const { title, startTime, endTime, attendees = [], organizer = {} } = payload;
        console.log(`📅 New Booking: ${title}`);
        console.log(`   Time: ${startTime} → ${endTime}`);
        console.log(`   Organizer: ${organizer.name} (${organizer.email})`);
        attendees.forEach((a) =>
          console.log(`   Attendee: ${a.name} (${a.email}, ${a.timeZone})`)
        );
        // TODO: Forward to CRM, send Viber/SMS confirmation, notify agent
        break;
      }

      case "BOOKING_CANCELLED": {
        const { title, startTime, cancellationReason } = payload;
        console.log(`❌ Cancelled: ${title} (${startTime})`);
        console.log(`   Reason: ${cancellationReason || "No reason provided"}`);
        // TODO: Update CRM, notify agent, offer reschedule
        break;
      }

      case "BOOKING_RESCHEDULED": {
        const { title, startTime, endTime, rescheduleReason } = payload;
        console.log(`🔄 Rescheduled: ${title}`);
        console.log(`   New Time: ${startTime} → ${endTime}`);
        console.log(`   Reason: ${rescheduleReason || "No reason provided"}`);
        // TODO: Update CRM, send updated confirmation
        break;
      }

      case "MEETING_STARTED": {
        const { title, startTime } = payload;
        console.log(`🟢 Meeting Started: ${title} (${startTime})`);
        // TODO: Log meeting start, trigger recording if needed
        break;
      }

      case "MEETING_ENDED": {
        const { title, startTime, endTime } = payload;
        console.log(`🔴 Meeting Ended: ${title} (${startTime} → ${endTime})`);
        // TODO: Log meeting end, trigger follow-up sequence
        break;
      }

      default:
        console.log(`⚠️ Unhandled event: ${triggerEvent}`);
        console.log(`   Payload: ${JSON.stringify(payload)}`);
    }

    return new Response(
      JSON.stringify({ status: "ok", event: triggerEvent }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Webhook error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
}
