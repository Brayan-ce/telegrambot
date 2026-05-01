import VerUsuario from '../../../../../_Extras/main/usuarios/ver';
import { use } from 'react';

export default function VerUsuarioPage({ params }) {
  const { id } = use(params);
  return <VerUsuario id={id} />;
}
