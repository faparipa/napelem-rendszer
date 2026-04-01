import { Navigate, Outlet } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';

const ProtectedRoute = ({ allowedRoles }) => {
  const token = localStorage.getItem('token');

  if (!token) {
    // Nincs token -> irány a login
    return <Navigate to='/login' replace />;
  }

  try {
    const decoded = jwtDecode(token);
    const userRole = decoded.role; // Feltételezve, hogy a backend 'role' néven küldi

    // AZ ADMIN MINDENT LÁT:
    // Ha a felhasználó Adminisztrátor, VAGY a szerepköre benne van a megengedett listában
    const hasAccess =
      userRole === 'Adminisztrator' || allowedRoles.includes(userRole);

    if (!hasAccess) {
      // Van token, de nincs joga ehhez az oldalhoz
      return <Navigate to='/login' replace />;
    }

    // Minden OK, mehet a kért oldalra
    return <Outlet />;
  } catch (error) {
    // Hibás token esetén törlés és login
    localStorage.removeItem('token');
    return <Navigate to='/login' replace />;
  }
};

export default ProtectedRoute;
