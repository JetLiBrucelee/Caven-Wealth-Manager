import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PublicLayout from "@/components/public-layout";
import {
  CreditCard,
  LineChart,
  Layers,
  Wallet,
  ArrowRight,
  CheckCircle,
} from "lucide-react";

const services = [
  {
    id: "totalpay",
    icon: CreditCard,
    title: "Caven Financial TotalPay",
    subtitle: "Comprehensive Banking Solutions",
    description:
      "TotalPay is our flagship banking solution, offering flexible terms and competitive rates that help clients manage and grow their finances.",
    features: [
      "Flexible payment schedules tailored to client needs",
      "Competitive interest rates with transparent pricing",
      "Fast approval and funding process",
      "Seamless integration with banking management systems",
      "Dedicated account management support",
    ],
  },
  {
    id: "wealth",
    icon: LineChart,
    title: "Caven Wealth Financial",
    subtitle: "Wealth Management Solutions",
    description:
      "Our wealth management division provides comprehensive financial planning and investment strategies designed to help individuals and businesses achieve their long-term financial goals.",
    features: [
      "Personalized financial planning and advisory",
      "Diversified investment portfolio management",
      "Retirement planning and strategy development",
      "Risk assessment and mitigation",
      "Estate and succession planning guidance",
    ],
  },
  {
    id: "platform",
    icon: Layers,
    title: "ONE Platform",
    subtitle: "Integrated Technology Solution",
    description:
      "The ONE Platform brings together all of our services into a single, unified interface. Streamline your operations, reduce manual tasks, and gain real-time insights into your business performance.",
    features: [
      "Unified dashboard for all financial operations",
      "Real-time reporting and analytics",
      "Automated workflow management",
      "Secure document storage and eSignature",
      "API integrations with major industry platforms",
    ],
  },
  {
    id: "payments",
    icon: Wallet,
    title: "Caven Financial Payments",
    subtitle: "Seamless Payment Processing",
    description:
      "Our payment processing solutions make it easy for clients to manage payments and transfers. Support for multiple payment methods and automated recurring billing.",
    features: [
      "Multiple payment method support (ACH, credit, debit)",
      "Automated recurring payment scheduling",
      "Real-time payment tracking and notifications",
      "PCI-compliant secure processing",
      "Custom-branded payment portals for clients",
    ],
  },
];

export default function Operations() {
  return (
    <PublicLayout>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900 via-blue-800 to-purple-900" />
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <h1 className="text-4xl md:text-5xl font-bold text-white" data-testid="text-operations-title">
            Our Operations
          </h1>
          <p className="mt-4 text-lg text-blue-100 max-w-2xl">
            Four powerful solutions working together to deliver a complete financial 
            services ecosystem for banking professionals.
          </p>
        </div>
      </section>

      <section className="py-16 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
          {services.map((service, idx) => (
            <div
              key={service.id}
              className={`grid grid-cols-1 lg:grid-cols-2 gap-8 items-start ${
                idx % 2 === 1 ? "lg:direction-rtl" : ""
              }`}
              data-testid={`section-service-${service.id}`}
            >
              <div className={idx % 2 === 1 ? "lg:order-2" : ""}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="rounded-md bg-blue-50 dark:bg-blue-900/30 p-3">
                    <service.icon className="h-6 w-6 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-blue-500">{service.subtitle}</p>
                    <h2 className="text-2xl font-bold text-foreground">{service.title}</h2>
                  </div>
                </div>
                <p className="text-muted-foreground text-lg">{service.description}</p>
              </div>

              <Card className={`overflow-visible ${idx % 2 === 1 ? "lg:order-1" : ""}`}>
                <CardHeader>
                  <CardTitle className="text-lg">Key Features</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {service.features.map((feat, fi) => (
                      <li key={fi} className="flex items-start gap-2">
                        <CheckCircle className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
                        <span className="text-sm text-foreground">{feat}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-gradient-to-r from-blue-600 to-purple-700 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white">Ready to Get Started?</h2>
          <p className="mt-4 text-blue-100 max-w-2xl mx-auto">
            Contact our team to learn how our solutions can work for your business.
          </p>
          <Link href="/contact">
            <Button
              size="lg"
              className="mt-6 bg-white text-blue-700 border-white"
              data-testid="button-operations-contact"
            >
              Contact Us
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}
