import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login          from './pages/Login'
import Register       from './pages/Register'
import Dashboard      from './pages/Dashboard'
import Locations      from './pages/admin/Locations'
import Products       from './pages/admin/Products'
import Prices         from './pages/admin/Prices'
import Staff          from './pages/admin/Staff'
import Inventory      from './pages/Inventory'
import Sales          from './pages/Sales'
import StockQuery     from './pages/StockQuery'
import AuditLog       from './pages/AuditLog'
import Debtors        from './pages/Debtors'
import Export         from './pages/Export'
import ProtectedRoute from './components/ProtectedRoute'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"         element={<Navigate to="/login" replace />} />
        <Route path="/login"    element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/inventory" element={<ProtectedRoute allowedRoles={['company_admin','super_admin','staff']}><Inventory /></ProtectedRoute>} />
        <Route path="/sales"     element={<ProtectedRoute allowedRoles={['company_admin','super_admin','staff']}><Sales /></ProtectedRoute>} />
        <Route path="/debtors"   element={<ProtectedRoute allowedRoles={['company_admin','super_admin','staff']}><Debtors /></ProtectedRoute>} />
        <Route path="/query"     element={<ProtectedRoute><StockQuery /></ProtectedRoute>} />
        <Route path="/audit"     element={<ProtectedRoute allowedRoles={['company_admin','super_admin']}><AuditLog /></ProtectedRoute>} />
        <Route path="/export"    element={<ProtectedRoute allowedRoles={['company_admin','super_admin']}><Export /></ProtectedRoute>} />

        <Route path="/admin/locations" element={<ProtectedRoute allowedRoles={['company_admin','super_admin']}><Locations /></ProtectedRoute>} />
        <Route path="/admin/products"  element={<ProtectedRoute allowedRoles={['company_admin','super_admin']}><Products /></ProtectedRoute>} />
        <Route path="/admin/prices"    element={<ProtectedRoute allowedRoles={['company_admin','super_admin']}><Prices /></ProtectedRoute>} />
        <Route path="/admin/staff"     element={<ProtectedRoute allowedRoles={['company_admin','super_admin']}><Staff /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  )
}