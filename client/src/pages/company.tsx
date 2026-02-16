import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import PublicLayout from "@/components/public-layout";
import {
  Building2,
  Target,
  Heart,
  Users,
  Calendar,
  Award,
  Shield,
  Lightbulb,
} from "lucide-react";

const timeline = [
  { year: "1977", event: "Founded as a premium financing company serving the southeastern United States." },
  { year: "1990", event: "Expanded operations nationwide, becoming one of the top 10 premium finance companies in the U.S." },
  { year: "2005", event: "Launched digital platform for online policy management and payment processing." },
  { year: "2015", event: "Introduced the ONE Platform, unifying all services into a single integrated solution." },
  { year: "2020", event: "Surpassed $10 billion in annual financing volume and expanded into wealth management." },
  { year: "2024", event: "Financed $17 billion across 835,000 loans with a 97% customer satisfaction rating." },
];

const values = [
  {
    icon: Shield,
    title: "Integrity",
    desc: "We operate with the highest ethical standards, earning trust through transparency and accountability.",
  },
  {
    icon: Lightbulb,
    title: "Innovation",
    desc: "We continuously invest in technology and processes to deliver better outcomes for our clients.",
  },
  {
    icon: Heart,
    title: "Service",
    desc: "We are committed to providing exceptional service that exceeds expectations at every touchpoint.",
  },
  {
    icon: Users,
    title: "Partnership",
    desc: "We build lasting relationships by treating our clients as true partners in success.",
  },
];

const leadership = [
  { name: "James Caven", title: "Chief Executive Officer", years: "25+ years in financial services" },
  { name: "Sarah Mitchell", title: "Chief Financial Officer", years: "20+ years in corporate finance" },
  { name: "David Chen", title: "Chief Technology Officer", years: "18+ years in fintech innovation" },
  { name: "Maria Rodriguez", title: "Chief Operating Officer", years: "22+ years in operations management" },
];

export default function Company() {
  return (
    <PublicLayout>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900 via-blue-800 to-purple-900" />
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <h1 className="text-4xl md:text-5xl font-bold text-white" data-testid="text-company-title">
            Our Company
          </h1>
          <p className="mt-4 text-lg text-blue-100 max-w-2xl">
            Nearly five decades of innovation, integrity, and excellence in financial services.
          </p>
        </div>
      </section>

      <section className="py-16 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="h-6 w-6 text-blue-500" />
                <h2 className="text-3xl font-bold text-foreground" data-testid="text-history-heading">
                  Our History
                </h2>
              </div>
              <p className="text-muted-foreground text-lg">
                Founded in 1977, Caven Wealth Financial began with a simple mission: to make 
                premium financing accessible, efficient, and fair. Over the decades, we have 
                grown from a regional provider into one of the largest and most trusted names in 
                premium financing in the United States and Puerto Rico.
              </p>
              <p className="mt-4 text-muted-foreground">
                Today, we serve thousands of insurance agencies and their policyholders, 
                processing billions of dollars in financing annually through our proprietary 
                technology platform.
              </p>
            </div>

            <div className="space-y-4">
              {timeline.map((item, i) => (
                <div key={i} className="flex gap-4" data-testid={`timeline-item-${i}`}>
                  <div className="flex flex-col items-center">
                    <div className="rounded-full bg-blue-500 w-3 h-3 mt-1.5 shrink-0" />
                    {i < timeline.length - 1 && (
                      <div className="w-px flex-1 bg-blue-200 dark:bg-blue-800 mt-1" />
                    )}
                  </div>
                  <div className="pb-6">
                    <span className="text-sm font-semibold text-blue-500">{item.year}</span>
                    <p className="text-sm text-muted-foreground mt-0.5">{item.event}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-gray-50 dark:bg-gray-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Target className="h-6 w-6 text-blue-500" />
              <h2 className="text-3xl font-bold text-foreground" data-testid="text-mission-heading">
                Our Mission
              </h2>
            </div>
            <p className="text-muted-foreground max-w-3xl mx-auto text-lg">
              To empower insurance professionals with innovative financing solutions and 
              technology that drive growth, efficiency, and exceptional customer experiences.
            </p>
          </div>

          <h3 className="text-2xl font-bold text-foreground text-center mb-8" data-testid="text-values-heading">
            Our Core Values
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((val, i) => (
              <Card key={i} className="overflow-visible" data-testid={`card-value-${i}`}>
                <CardContent className="p-6 text-center">
                  <div className="rounded-md bg-blue-50 dark:bg-blue-900/30 p-3 w-fit mx-auto mb-4">
                    <val.icon className="h-6 w-6 text-blue-500" />
                  </div>
                  <h4 className="font-semibold text-foreground">{val.title}</h4>
                  <p className="mt-2 text-sm text-muted-foreground">{val.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Users className="h-6 w-6 text-blue-500" />
              <h2 className="text-3xl font-bold text-foreground" data-testid="text-team-heading">
                Leadership Team
              </h2>
            </div>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Our experienced leadership team brings decades of expertise in financial services, 
              technology, and operations management.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {leadership.map((person, i) => (
              <Card key={i} className="overflow-visible" data-testid={`card-leader-${i}`}>
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 mx-auto mb-4 flex items-center justify-center">
                    <span className="text-xl font-bold text-white">
                      {person.name.split(" ").map(n => n[0]).join("")}
                    </span>
                  </div>
                  <h4 className="font-semibold text-foreground">{person.name}</h4>
                  <p className="text-sm text-blue-500">{person.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{person.years}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-r from-blue-600 to-purple-700 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white">Join Our Growing Team</h2>
          <p className="mt-4 text-blue-100 max-w-2xl mx-auto">
            We are always looking for talented individuals who share our passion for 
            innovation and customer excellence.
          </p>
          <Link href="/careers">
            <Button
              size="lg"
              className="mt-6 bg-white text-blue-700 border-white"
              data-testid="button-company-careers"
            >
              View Open Positions
            </Button>
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}
