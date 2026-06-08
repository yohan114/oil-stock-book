import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Ledger from './pages/Ledger.jsx';
import ProductDetail from './pages/ProductDetail.jsx';
import Machines from './pages/Machines.jsx';
import AssetDetail from './pages/AssetDetail.jsx';
import Projects from './pages/Projects.jsx';
import Trends from './pages/Trends.jsx';
import Mapping from './pages/Mapping.jsx';
import Settings from './pages/Settings.jsx';
import Report from './pages/Report.jsx';

export default function App() {
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
              <Route path="/trends" element={<Trends />} />
              <Route path="/mapping" element={<Mapping />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </Layout>
        }
      />
    </Routes>
  );
}
