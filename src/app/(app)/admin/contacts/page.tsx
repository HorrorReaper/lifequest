import { ContactsOverview } from '@/components/contacts/ContactsOverview'
import { getWorkContext } from '@/lib/work/context'
export default async function ContactsPage() {
 const { userId, today, timezone } = await getWorkContext()
 return <ContactsOverview userId={userId} today={today} timezone={timezone} />
}
