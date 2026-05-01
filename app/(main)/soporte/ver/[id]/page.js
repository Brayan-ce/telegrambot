import VerTicket from '../../../../../_Extras/main/soporte/ver';
import { use } from 'react';
export default function VerTicketPage({ params }) {
  const { id } = use(params);
  return <VerTicket id={id} />;
}
