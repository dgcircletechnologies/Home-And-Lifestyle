import { Boxes, CreditCard, FileText, FolderTree, LayoutDashboard, Package, Settings, ShoppingBag, Users } from 'lucide-react';
export const adminNavigation = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard, exact: true },
  { label: 'Catalogue', href: '/admin/categories', icon: FolderTree },
  { label: 'Products', href: '/admin/products', icon: Package },
  { label: 'Customers', href: '/admin/customers', icon: Users },
  { label: 'Orders', href: '/admin/orders', icon: ShoppingBag },
  { label: 'Payments', href: '/admin/payments', icon: CreditCard },
  { label: 'Promotions', href: '/admin/promotions', icon: Boxes },
  { label: 'Reviews', href: '/admin/reviews', icon: FileText },
  { label: 'Settings', href: '/admin/settings', icon: Settings },
];
