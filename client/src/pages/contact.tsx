import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PublicLayout from "@/components/public-layout";
import { Mail } from "lucide-react";

export default function Contact() {
  return (
    <PublicLayout>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900 via-blue-800 to-purple-900" />
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <h1 className="text-4xl md:text-5xl font-bold text-white" data-testid="text-contact-title">
            Contact Us
          </h1>
          <p className="mt-4 text-lg text-blue-100 max-w-2xl">
            Get in touch with our team. We are here to answer your questions and help you 
            find the right solutions.
          </p>
        </div>
      </section>

      <section className="py-16 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <Card className="overflow-hidden">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-md bg-blue-50 dark:bg-blue-900/30 p-2">
                    <Mail aria-hidden="true" className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <CardTitle>Email our support team</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  For assistance, contact our team directly. Selecting the email address opens
                  your email app so you can send us a message.
                </p>
                <a
                  href="mailto:support@cavenwealthfinancial.com"
                  aria-label="Email support at support@cavenwealthfinancial.com"
                  data-testid="link-contact-email"
                  className="inline-flex max-w-full items-center gap-2 rounded-md font-medium text-blue-700 underline decoration-blue-300 underline-offset-4 transition-colors hover:text-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:text-blue-300 dark:hover:text-blue-200 [overflow-wrap:anywhere] break-all"
                >
                  support@cavenwealthfinancial.com
                </a>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
