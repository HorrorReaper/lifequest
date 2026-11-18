/**
 * The address the scheduler was first set up with. It runs the same
 * reminders as /api/push/reminders, so a pg_cron job that still calls it
 * keeps working; new setups call /api/push/reminders.
 */
export { GET, POST } from '../reminders/route'
