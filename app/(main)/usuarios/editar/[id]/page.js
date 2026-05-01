import EditarUsuario from '../../../../../_Extras/main/usuarios/editar';
import { use } from 'react';

export default function EditarUsuarioPage({ params }) {
  const { id } = use(params);
  return <EditarUsuario id={id} />;
}
