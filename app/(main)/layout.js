import Header from '../../_Extras/main/layout/header/header';

export default function MainLayout({ children }) {
  return (
    <div>
      <Header>
       {children}
      </Header> 
    </div>
  );
}
