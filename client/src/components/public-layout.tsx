import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Menu, X, ChevronDown } from "lucide-react";
import { useState, useRef } from "react";

const navLinks = [
  {
    label: "Home",
    href: "/",
    dropdown: [
      { label: "Welcome", href: "/" },
      { label: "About Us", href: "/company" },
      { label: "Customer Login", href: "/portal" },
    ],
  },
  {
    label: "Operations",
    href: "/operations",
    dropdown: [
      { label: "TotalPay", href: "/operations" },
      { label: "Wealth Management", href: "/operations" },
      { label: "ONE Platform", href: "/operations" },
      { label: "Payments", href: "/operations" },
    ],
  },
  {
    label: "Company",
    href: "/company",
    dropdown: [
      { label: "About Us", href: "/company" },
      { label: "Leadership", href: "/company" },
      { label: "Our History", href: "/company" },
    ],
  },
  {
    label: "Contact",
    href: "/contact",
    dropdown: [
      { label: "Get In Touch", href: "/contact" },
      { label: "Support", href: "/contact" },
      { label: "Office Locations", href: "/contact" },
    ],
  },
  {
    label: "Careers",
    href: "/careers",
    dropdown: [
      { label: "Open Positions", href: "/careers" },
      { label: "Benefits", href: "/careers" },
      { label: "Culture", href: "/careers" },
    ],
  },
];

function NavDropdown({ item, isActive }: { item: typeof navLinks[0]; isActive: boolean }) {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpen(true);
  };

  const handleLeave = () => {
    timeoutRef.current = setTimeout(() => setOpen(false), 150);
  };

  return (
    <div
      className="relative"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <Link href={item.href}>
        <span
          data-testid={`link-nav-${item.label.toLowerCase()}`}
          className={`flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 cursor-pointer ${
            isActive
              ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30"
              : "text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400"
          }`}
        >
          {item.label}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </span>
      </Link>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-52 bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-800 py-2 z-[100] animate-in fade-in slide-in-from-top-2 duration-200">
          {item.dropdown.map((sub, i) => (
            <Link key={i} href={sub.href}>
              <span
                onClick={() => setOpen(false)}
                className="block px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                data-testid={`link-dropdown-${item.label.toLowerCase()}-${i}`}
              >
                {sub.label}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Header() {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedMobile, setExpandedMobile] = useState<string | null>(null);

  return (
    <header className="sticky top-0 z-50 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200/60 dark:border-gray-800/60 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 h-16">
          <Link href="/" data-testid="link-logo">
            <img
              src="/logo.png"
              alt="Caven Wealth Financial"
              className="h-10 w-auto object-contain"
            />
          </Link>

          <nav className="hidden md:flex items-center gap-0.5" data-testid="nav-desktop">
            {navLinks.map((link) => {
              const isActive = location === link.href;
              return <NavDropdown key={link.href} item={link} isActive={isActive} />;
            })}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <Link href="/portal">
              <Button
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg shadow-blue-500/25 transition-all duration-200"
                data-testid="button-login"
              >
                Login
              </Button>
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
              const isExpanded = expandedMobile === link.label;
              return (
                <div key={link.href}>
                  <div
                    className={`flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium cursor-pointer ${
                      isActive
                        ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30"
                        : "text-gray-700 dark:text-gray-300"
                    }`}
                    onClick={() => setExpandedMobile(isExpanded ? null : link.label)}
                  >
                    <span data-testid={`link-mobile-nav-${link.label.toLowerCase()}`}>
                      {link.label}
                    </span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  </div>
                  {isExpanded && (
                    <div className="pl-6 space-y-1 mt-1">
                      {link.dropdown.map((sub, i) => (
                        <Link key={i} href={sub.href}>
                          <span
                            onClick={() => setMobileOpen(false)}
                            className="block px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600"
                          >
                            {sub.label}
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            <Link href="/portal">
              <Button className="w-full mt-2 bg-gradient-to-r from-blue-600 to-blue-700" data-testid="button-mobile-login">
                Login
              </Button>
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
            <img src="/logo.png" alt="Caven Wealth Financial" className="h-10 w-auto object-contain mb-4 brightness-200" />
            <p className="mt-1 text-sm text-gray-400 max-w-md">
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
                      className="text-gray-400 hover:text-white transition-colors cursor-pointer"
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
              <li>New York, USA 10001</li>
              <li>Phone: (254) 421-9855</li>
              <li>support@cavenwealthfinancial.com</li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-500">
            &copy; {new Date().getFullYear()} Caven Wealth Financial. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="hover:text-gray-300 cursor-pointer transition-colors">Privacy Policy</span>
            <span className="hover:text-gray-300 cursor-pointer transition-colors">Terms of Service</span>
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
