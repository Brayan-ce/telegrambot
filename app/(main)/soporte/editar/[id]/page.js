import EditarTicket from '../../../../../_Extras/main/soporte/editar';
import { use } from 'react';
export default function EditarTicketPage({ params }) {
  const { id } = use(params);
  return <EditarTicket id={id} />;
}
