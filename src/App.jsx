import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login          from './pages/auth/Login'
import Register       from './pages/auth/Register'
import Dashboard      from './pages/operations/Dashboard'
import Inventory      from './pages/operations/Inventory'
import Sales          from './pages/operations/Sales'
import StockQuery     from './pages/reports/StockQuery'
import AuditLog       from './pages/reports/AuditLog'
import Debtors        from './pages/operations/Debtors'
import Export         from './pages/reports/Export'
import QueryHistory   from './pages/reports/QueryHistory'
import Orders         from './pages/reports/Orders'
import OrderDetail    from './pages/reports/OrderDetail'
import Locations      from './pages/admin/Locations'
import Products       from './pages/admin/Products'
import Prices         from './pages/admin/Prices'
import Staff          from './pages/admin/Staff'
import Settings       from './pages/admin/Settings'
import ProtectedRoute from './components/ProtectedRoute'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"         element={<Navigate to="/login" replace />} />
        <Route path="/login"    element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route path="/dashboard" element={<ProtectedRoute allowedRoles={['company_admin','super_admin']}><Dashboard /></ProtectedRoute>} />
        <Route path="/inventory" element={<ProtectedRoute allowedRoles={['company_admin','super_admin']}><Inventory /></ProtectedRoute>} />
        <Route path="/sales"     element={<ProtectedRoute allowedRoles={['company_admin','super_admin','staff']}><Sales /></ProtectedRoute>} />
        <Route path="/debtors"   element={<ProtectedRoute allowedRoles={['company_admin','super_admin','staff']}><Debtors /></ProtectedRoute>} />
        <Route path="/query"     element={<ProtectedRoute><StockQuery /></ProtectedRoute>} />
        <Route path="/audit"     element={<ProtectedRoute allowedRoles={['company_admin','super_admin']}><AuditLog /></ProtectedRoute>} />
        <Route path="/reports/query-history" element={<ProtectedRoute allowedRoles={['company_admin','super_admin']}><QueryHistory /></ProtectedRoute>} />
        <Route path="/orders"    element={<ProtectedRoute><Orders /></ProtectedRoute>} />
        <Route path="/orders/:id" element={<ProtectedRoute><OrderDetail /></ProtectedRoute>} />
        <Route path="/export"    element={<ProtectedRoute allowedRoles={['company_admin','super_admin']}><Export /></ProtectedRoute>} />

        <Route path="/admin/locations" element={<ProtectedRoute allowedRoles={['company_admin','super_admin']}><Locations /></ProtectedRoute>} />
        <Route path="/admin/products"  element={<ProtectedRoute allowedRoles={['company_admin','super_admin']}><Products /></ProtectedRoute>} />
        <Route path="/admin/prices"    element={<ProtectedRoute allowedRoles={['company_admin','super_admin']}><Prices /></ProtectedRoute>} />
        <Route path="/admin/staff"     element={<ProtectedRoute allowedRoles={['company_admin','super_admin']}><Staff /></ProtectedRoute>} />
        <Route path="/admin/settings"  element={<ProtectedRoute allowedRoles={['company_admin','super_admin']}><Settings /></ProtectedRoute>} />
        {/* /admin/migrate redirected — migration is now inside /admin/products */}
        <Route path="/admin/migrate"   element={<Navigate to="/admin/products" replace />} />
      </Routes>
    </BrowserRouter>
  )
}