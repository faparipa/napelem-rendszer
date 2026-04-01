import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import AdminDashboard from './pages/Admin/AdminDashboard';
import UserManagement from './pages/Admin/UserManagement';
import PartsManagement from './pages/Manager/PartsManagement';
import WarehouseManagement from './pages/Manager/WarehouseManagement';
import ManagerDashboard from './pages/Manager/ManagerDashboard';
import WorkerDashboard from './pages/Worker/WorkerDashboard';
import ExpertDashboard from './pages/Expert/ExpertDashboard';

function App() {
  return (
    <Router>
      <Routes>
        <Route path='/login' element={<Login />} />

        {/* --- ADMIN: Csak Adminisztrator --- */}
        <Route element={<ProtectedRoute allowedRoles={['Adminisztrator']} />}>
          <Route path='/admin' element={<AdminDashboard />}>
            <Route path='users' element={<UserManagement />} />
            <Route path='parts' element={<PartsManagement />} />
            <Route path='map' element={<WarehouseManagement />} />
            <Route path='expert' element={<ExpertDashboard />} />
          </Route>
        </Route>

        {/* --- MANAGER: Admin és Raktárvezető látja --- */}
        <Route element={<ProtectedRoute allowedRoles={['Raktarvezeto']} />}>
          <Route path='/manager' element={<ManagerDashboard />} />
        </Route>

        {/* --- RAKTÁROS: Csak Admin és Raktáros --- */}
        <Route element={<ProtectedRoute allowedRoles={['Raktaros']} />}>
          <Route path='/worker' element={<WorkerDashboard />} />
        </Route>

        {/* --- SZAKEMBER: Csak Admin és Szakember --- */}
        <Route element={<ProtectedRoute allowedRoles={['Szakember']} />}>
          <Route path='/expert' element={<ExpertDashboard />} />
        </Route>
        <Route path='/' element={<Navigate to='/login' />} />
      </Routes>
    </Router>
  );
}

export default App;
