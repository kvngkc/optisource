import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login          from './pages/Login'
import Register       from './pages/Register'
import Dashboard      from './pages/Dashboard'
import Locations      from './pages/admin/Locations'
import Products       from './pages/admin/Products'
import Staff          from './pages/admin/Staff'
import Inventory      from './pages/Inventory'
import Sales          from './pages/Sales'
import StockQuery     from './pages/StockQuery'
import AuditLog       from './pages/AuditLog'
import ProtectedRoute from './components/ProtectedRoute'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"         element={<Navigate to="/login" replace />} />
        <Route path="/login"    element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route path="/dashboard" element={
          <ProtectedRoute><Dashboard /></ProtectedRoute>
        } />
        <Route path="/admin/locations" element={
          <ProtectedRoute allowedRoles={['company_admin','super_admin']}>
            <Locations />
          </ProtectedRoute>
        } />
        <Route path="/admin/products" element={
          <ProtectedRoute allowedRoles={['company_admin','super_admin']}>
            <Products />
          </ProtectedRoute>
        } />
        <Route path="/admin/staff" element={
          <ProtectedRoute allowedRoles={['company_admin','super_admin']}>
            <Staff />
          </ProtectedRoute>
        } />
        <Route path="/inventory" element={
          <ProtectedRoute allowedRoles={['company_admin','super_admin','staff']}>
            <Inventory />
          </ProtectedRoute>
        } />
        <Route path="/sales" element={
          <ProtectedRoute allowedRoles={['company_admin','super_admin','staff']}>
            <Sales />
          </ProtectedRoute>
        } />
        <Route path="/query" element={
          <ProtectedRoute>
            <StockQuery />
          </ProtectedRoute>
        } />
        <Route path="/audit" element={
          <ProtectedRoute allowedRoles={['company_admin','super_admin']}>
            <AuditLog />
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  )
}