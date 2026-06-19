import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth.jsx';
import { Spinner } from './components/ui.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Ledger from './pages/Ledger.jsx';
import ProductDetail from './pages/ProductDetail.jsx';
import Machines from './pages/Machines.jsx';
import AssetDetail from './pages/AssetDetail.jsx';
import Projects from './pages/Projects.jsx';
import ProjectDetail from './pages/ProjectDetail.jsx';
import Trends from './pages/Trends.jsx';
import Mapping from './pages/Mapping.jsx';
import Settings from './pages/Settings.jsx';
import Report from './pages/Report.jsx';
import Batteries from './pages/Batteries.jsx';
import StockTake from './pages/StockTake.jsx';
import Users from './pages/Users.jsx';
import Requisitions from './pages/Requisitions.jsx';

function Gate() {
  const { user, ready } = useAuth();
  if (!ready) return <div className="min-h-screen grid place-items-center"><Spinner /></div>;
  if (!user) return <Login />;

  const staff = user.role === 'admin' || user.role === 'storekeeper';
  return (
    <Routes>
      {/* Printable report is full-screen, outside the app chrome */}
      <Route path="/report/:id" element={<Report />} />
      <Route
        path="*"
        element={
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/ledger" element={<Ledger />} />
              <Route path="/products/:id" element={<ProductDetail />} />
              <Route path="/machines" element={<Machines />} />
              <Route path="/machines/:id" element={<AssetDetail />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/projects/:id" element={<ProjectDetail />} />
              <Route path="/requisitions" element={<Requisitions />} />
              <Route path="/batteries" element={<Batteries />} />
              {staff && <Route path="/stock-take" element={<StockTake />} />}
              {staff && <Route path="/trends" element={<Trends />} />}
              {staff && <Route path="/mapping" element={<Mapping />} />}
              {staff && <Route path="/settings" element={<Settings />} />}
              {user.role === 'admin' && <Route path="/users" element={<Users />} />}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
