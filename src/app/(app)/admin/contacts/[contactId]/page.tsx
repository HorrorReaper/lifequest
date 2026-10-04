import { notFound } from 'next/navigation'
import { ContactDetail } from '@/components/contacts/ContactDetail'
import { getWorkContext } from '@/lib/work/context'
export default async function ContactPage({ params }: { params: Promise<{ contactId: string }> }) {
 const { contactId } = await params
 if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(contactId)) notFound()
 const { supabase, userId, today } = await getWorkContext()
 const { data, error } = await supabase.from('contacts').select('id').eq('id',contactId).eq('user_id',userId).maybeSingle()
 if(error) throw new Error('Kontakt konnte nicht geladen werden.')
 if(!data) notFound()
 return <ContactDetail key={contactId} contactId={contactId} userId={userId} today={today} />
}
