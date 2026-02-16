import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useState } from "react";

const navLinks = [
  { label: "Home", href: "/" },
  { label: "Operations", href: "/operations" },
  { label: "Company", href: "/company" },
  { label: "Contact", href: "/contact" },
  { label: "Careers", href: "/careers" },
];

function Header() {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 h-16">
          <Link href="/" data-testid="link-logo">
            <span className="text-xl font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
              Caven Financial Wealth
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1" data-testid="nav-desktop">
            {navLinks.map((link) => {
              const isActive = location === link.href;
              return (
                <Link key={link.href} href={link.href}>
                  <span
                    data-testid={`link-nav-${link.label.toLowerCase()}`}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30"
                        : "text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {link.label}
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <Link href="/portal">
              <Button data-testid="button-user-portal">User Portal</Button>
            </Link>
            <Link href="/admin/login">
              <span
                data-testid="link-admin-login"
                className="text-xs text-muted-foreground"
              >
                Admin Login
              </span>
            </Link>
          </div>

          <Button
            size="icon"
            variant="ghost"
            className="md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            data-testid="button-mobile-menu"
          >
            {mobileOpen ? <X /> : <Menu />}
          </Button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 pb-4">
          <nav className="flex flex-col gap-1 pt-2">
            {navLinks.map((link) => {
              const isActive = location === link.href;
              return (
                <Link key={link.href} href={link.href}>
                  <span
                    onClick={() => setMobileOpen(false)}
                    data-testid={`link-mobile-nav-${link.label.toLowerCase()}`}
                    className={`block px-3 py-2 rounded-md text-sm font-medium ${
                      isActive
                        ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30"
                        : "text-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {link.label}
                  </span>
                </Link>
              );
            })}
            <Link href="/portal">
              <Button className="w-full mt-2" data-testid="button-mobile-user-portal">
                User Portal
              </Button>
            </Link>
            <Link href="/admin/login">
              <span className="block text-xs text-muted-foreground text-center mt-1">
                Admin Login
              </span>
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}

function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <span className="text-xl font-bold text-white">Caven Financial Wealth</span>
            <p className="mt-3 text-sm text-gray-400 max-w-md">
              A trusted leader in premium financing and wealth management solutions, 
              serving clients across the United States and Puerto Rico since 1977.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>
                    <span
                      data-testid={`link-footer-${link.label.toLowerCase()}`}
                      className="text-gray-400 transition-colors"
                    >
                      {link.label}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Contact</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li>1000 Corporate Drive, Suite 500</li>
              <li>Fort Lauderdale, FL 33334</li>
              <li>Phone: (800) 555-0199</li>
              <li>info@cavenfinancial.com</li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-500">
            &copy; {new Date().getFullYear()} Caven Financial Wealth. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>Privacy Policy</span>
            <span>Terms of Service</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
