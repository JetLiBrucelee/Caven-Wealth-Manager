import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PublicLayout from "@/components/public-layout";
import {
  Briefcase,
  MapPin,
  Clock,
  ChevronRight,
  Heart,
  GraduationCap,
  Umbrella,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const openings = [
  {
    id: 1,
    title: "Senior Software Engineer",
    department: "Engineering",
    location: "Fort Lauderdale, FL",
    type: "Full-Time",
    description:
      "Build and maintain our core platform services, working with modern web technologies to deliver scalable financial solutions.",
  },
  {
    id: 2,
    title: "Product Manager",
    department: "Product",
    location: "Fort Lauderdale, FL",
    type: "Full-Time",
    description:
      "Drive product strategy and roadmap for our ONE Platform, collaborating with engineering and design teams.",
  },
  {
    id: 3,
    title: "Financial Analyst",
    department: "Finance",
    location: "Remote",
    type: "Full-Time",
    description:
      "Analyze financial data, prepare reports, and support strategic decision-making for our banking operations.",
  },
  {
    id: 4,
    title: "Client Success Manager",
    department: "Client Services",
    location: "Fort Lauderdale, FL",
    type: "Full-Time",
    description:
      "Manage relationships with agency partners, ensuring they maximize value from our platform and services.",
  },
  {
    id: 5,
    title: "UX Designer",
    department: "Design",
    location: "Remote",
    type: "Full-Time",
    description:
      "Design intuitive interfaces for our financial products, conducting user research and creating wireframes and prototypes.",
  },
  {
    id: 6,
    title: "DevOps Engineer",
    department: "Engineering",
    location: "Fort Lauderdale, FL",
    type: "Full-Time",
    description:
      "Manage cloud infrastructure, CI/CD pipelines, and ensure high availability of our financial services platform.",
  },
];

const benefits = [
  {
    icon: Heart,
    title: "Health & Wellness",
    desc: "Comprehensive medical, dental, and vision coverage for you and your family.",
  },
  {
    icon: TrendingUp,
    title: "401(k) Match",
    desc: "Generous retirement savings match to help you plan for the future.",
  },
  {
    icon: GraduationCap,
    title: "Learning & Development",
    desc: "Professional development budget and continuous learning opportunities.",
  },
  {
    icon: Umbrella,
    title: "Paid Time Off",
    desc: "Competitive PTO policy plus company holidays and volunteer days.",
  },
];

export default function Careers() {
  return (
    <PublicLayout>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900 via-blue-800 to-purple-900" />
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <h1 className="text-4xl md:text-5xl font-bold text-white" data-testid="text-careers-title">
            Careers
          </h1>
          <p className="mt-4 text-lg text-blue-100 max-w-2xl">
            Join a team that is redefining the future of financial services. We are looking 
            for talented people who are passionate about making a difference.
          </p>
        </div>
      </section>

      <section className="py-16 bg-gray-50 dark:bg-gray-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-foreground text-center mb-4" data-testid="text-benefits-heading">
            Why Work With Us
          </h2>
          <p className="text-muted-foreground text-center max-w-2xl mx-auto mb-10">
            We invest in our people because they are the foundation of our success.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.map((b, i) => (
              <Card key={i} className="overflow-visible" data-testid={`card-benefit-${i}`}>
                <CardContent className="p-6 text-center">
                  <div className="rounded-md bg-blue-50 dark:bg-blue-900/30 p-3 w-fit mx-auto mb-4">
                    <b.icon className="h-6 w-6 text-blue-500" />
                  </div>
                  <h4 className="font-semibold text-foreground">{b.title}</h4>
                  <p className="mt-2 text-sm text-muted-foreground">{b.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 mb-8">
            <Briefcase className="h-6 w-6 text-blue-500" />
            <h2 className="text-2xl font-bold text-foreground" data-testid="text-openings-heading">
              Open Positions
            </h2>
          </div>

          <div className="space-y-4">
            {openings.map((job) => (
              <Card key={job.id} className="overflow-visible" data-testid={`card-job-${job.id}`}>
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center flex-wrap gap-2 mb-1">
                        <h3 className="text-lg font-semibold text-foreground">{job.title}</h3>
                        <Badge variant="secondary">{job.department}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{job.description}</p>
                      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {job.location}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {job.type}
                        </span>
                      </div>
                    </div>
                    <Button variant="outline" data-testid={`button-apply-${job.id}`}>
                      Apply Now
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-r from-blue-600 to-purple-700 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white">Don't See Your Role?</h2>
          <p className="mt-4 text-blue-100 max-w-2xl mx-auto">
            We are always looking for exceptional talent. Send us your resume and we will 
            keep you in mind for future opportunities.
          </p>
          <Link href="/contact">
            <Button
              size="lg"
              className="mt-6 bg-white text-blue-700 border-white"
              data-testid="button-careers-contact"
            >
              Get in Touch
            </Button>
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}
