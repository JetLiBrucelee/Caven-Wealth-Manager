import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import PublicLayout from "@/components/public-layout";
import {
  CreditCard,
  Shield,
  Bell,
  Palette,
  ArrowRight,
  TrendingUp,
  Users,
  DollarSign,
  Award,
} from "lucide-react";

const stats = [
  { icon: TrendingUp, value: "48 Years", label: "Privately Held Since 1977" },
  { icon: Users, value: "835,000", label: "Loans in 2024" },
  { icon: DollarSign, value: "$17 Billion", label: "Financed in 2024" },
  { icon: Award, value: "97%", label: "Customer Satisfaction Rating" },
];

const features = [
  { icon: CreditCard, text: "Flexible online payment options" },
  { icon: Shield, text: "Secure eSignature" },
  { icon: Bell, text: "Cancellation avoidance alerts" },
  { icon: Palette, text: "Custom-branded products" },
];

const operations = [
  {
    num: "01",
    title: "Caven Financial TotalPay",
    desc: "A comprehensive payment solution that simplifies premium financing with flexible terms and competitive rates.",
  },
  {
    num: "02",
    title: "Caven Financial Wealth",
    desc: "Expert wealth management services designed to help you grow and protect your financial portfolio.",
  },
  {
    num: "03",
    title: "ONE Platform",
    desc: "An integrated technology platform that streamlines operations and enhances the customer experience.",
  },
  {
    num: "04",
    title: "Caven Financial Payments",
    desc: "Seamless payment processing solutions for insurance agencies and their policyholders.",
  },
];

export default function Home() {
  return (
    <PublicLayout>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900 via-blue-800 to-purple-900" />
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-36">
          <div className="max-w-3xl">
            <h1
              className="text-4xl md:text-6xl font-bold text-white leading-tight"
              data-testid="text-hero-headline"
            >
              One Platform. One Partner.
            </h1>
            <p
              className="mt-6 text-lg md:text-xl text-blue-100"
              data-testid="text-hero-subheadline"
            >
              The Right Technology From the Right People Forms the Foundation of Success.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link href="/operations">
                <Button
                  size="lg"
                  className="bg-white text-blue-900 border-white"
                  data-testid="button-hero-learn-more"
                >
                  Learn More
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/contact">
                <Button
                  size="lg"
                  variant="outline"
                  className="text-white border-white/40 backdrop-blur-sm bg-white/10"
                  data-testid="button-hero-contact"
                >
                  Contact Us
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white dark:bg-gray-900 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <div
                key={i}
                className="text-center"
                data-testid={`stat-card-${i}`}
              >
                <stat.icon className="h-8 w-8 text-blue-500 mx-auto mb-3" />
                <p className="text-3xl font-bold text-foreground">{stat.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2
                className="text-3xl font-bold text-foreground"
                data-testid="text-about-heading"
              >
                Built to Help You Succeed
              </h2>
              <p className="mt-4 text-muted-foreground text-lg">
                Caven Financial Wealth helps you generate revenue, automate processes,
                and provide great service.
              </p>
              <ul className="mt-8 space-y-4">
                {features.map((feat, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-md bg-blue-50 dark:bg-blue-900/30 p-2">
                      <feat.icon className="h-5 w-5 text-blue-500" />
                    </div>
                    <span className="text-foreground">{feat.text}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-md p-8 text-white">
              <h3 className="text-2xl font-bold">Why Choose Us</h3>
              <p className="mt-4 text-blue-100">
                With nearly five decades of experience, we combine cutting-edge technology 
                with personalized service to deliver results that matter. Our platform is 
                designed for speed, security, and scalability.
              </p>
              <Link href="/company">
                <Button
                  variant="outline"
                  className="mt-6 text-white border-white/40 backdrop-blur-sm bg-white/10"
                  data-testid="button-why-choose-us"
                >
                  About Our Company
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-gray-50 dark:bg-gray-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2
            className="text-3xl font-bold text-foreground text-center"
            data-testid="text-operations-heading"
          >
            Our Operations
          </h2>
          <p className="mt-3 text-muted-foreground text-center max-w-2xl mx-auto">
            Comprehensive solutions designed to power every aspect of your financial operations.
          </p>
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {operations.map((op) => (
              <Card key={op.num} className="overflow-visible" data-testid={`card-operation-${op.num}`}>
                <CardContent className="p-6">
                  <span className="text-4xl font-bold text-blue-500/20">{op.num}</span>
                  <h3 className="mt-2 text-lg font-semibold text-foreground">{op.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{op.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link href="/operations">
              <Button variant="outline" data-testid="button-view-operations">
                View All Operations
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-16 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-foreground" data-testid="text-company-heading">
            Our Company
          </h2>
          <p className="mt-4 text-muted-foreground max-w-3xl mx-auto text-lg">
            Caven Financial Wealth is a privately held company committed to innovation, 
            integrity, and the highest standards of service. We partner with agencies of 
            all sizes to deliver scalable financing solutions.
          </p>
          <Link href="/company">
            <Button className="mt-6" data-testid="button-learn-about-company">
              Learn More About Us
            </Button>
          </Link>
        </div>
      </section>

      <section className="bg-gradient-to-r from-blue-600 to-purple-700 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2
            className="text-3xl font-bold text-white"
            data-testid="text-cta-heading"
          >
            Contact us today to get started
          </h2>
          <p className="mt-4 text-blue-100 max-w-2xl mx-auto">
            Let us show you how our platform and services can transform your business.
          </p>
          <Link href="/contact">
            <Button
              size="lg"
              className="mt-6 bg-white text-blue-700 border-white"
              data-testid="button-cta-contact"
            >
              Contact Us
            </Button>
          </Link>
        </div>
      </section>

      <section className="py-12 bg-background">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-muted-foreground" data-testid="text-bottom-statement">
            Over the past 47 years, Caven Financial Wealth has grown into one of the 
            largest providers of premium financing in the United States and Puerto Rico.
          </p>
        </div>
      </section>
    </PublicLayout>
  );
}
