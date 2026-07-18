"use client";

import { Check, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const ACCENT = "var(--color-auth-super)";

const PLANS = [
  {
    key: "starter",
    label: "Starter",
    price: "Free",
    priceNote: "No credit card required",
    maxUsers: "500",
    features: [
      { label: "Up to 500 students & staff", included: true },
      { label: "Core messaging & chats", included: true },
      { label: "Academic groups", included: true },
      { label: "OTP authentication", included: true },
      { label: "Email support", included: true },
      { label: "Custom branding", included: false },
      { label: "Clubs & societies", included: false },
      { label: "Advanced analytics", included: false },
      { label: "Dedicated support", included: false },
      { label: "SLA guarantee", included: false },
    ],
  },
  {
    key: "growth",
    label: "Growth",
    price: "$199",
    priceNote: "per month",
    maxUsers: "5,000",
    popular: true,
    features: [
      { label: "Up to 5,000 students & staff", included: true },
      { label: "Core messaging & chats", included: true },
      { label: "Academic groups", included: true },
      { label: "OTP authentication", included: true },
      { label: "Priority email support", included: true },
      { label: "Custom branding", included: true },
      { label: "Clubs & societies", included: true },
      { label: "Advanced analytics", included: true },
      { label: "Dedicated support", included: false },
      { label: "SLA guarantee", included: false },
    ],
  },
  {
    key: "enterprise",
    label: "Enterprise",
    price: "Custom",
    priceNote: "contact sales",
    maxUsers: "Unlimited",
    features: [
      { label: "Unlimited students & staff", included: true },
      { label: "Core messaging & chats", included: true },
      { label: "Academic groups", included: true },
      { label: "OTP authentication", included: true },
      { label: "24/7 phone support", included: true },
      { label: "Custom branding", included: true },
      { label: "Clubs & societies", included: true },
      { label: "Advanced analytics", included: true },
      { label: "Dedicated success manager", included: true },
      { label: "99.9% SLA guarantee", included: true },
    ],
  },
];

export default function PlansPage() {
  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h2 className="text-heading">Subscription Plans</h2>
        <p className="text-subtitle mt-1">
          Plan tiers determine feature access and user limits per institution. Assign a plan from an institution&apos;s Details tab.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {PLANS.map((plan) => (
          <Card key={plan.key} className={`p-0 overflow-hidden gap-0 ${plan.popular ? "ring-2" : ""}`} style={plan.popular ? { borderColor: ACCENT, boxShadow: `0 0 0 1px ${ACCENT}` } as React.CSSProperties : undefined}>
            <div className="px-6 py-5 border-b border-border">
              {plan.popular && (
                <Badge className="mb-3" style={{ backgroundColor: `${ACCENT}1a`, color: ACCENT }}>
                  Most Popular
                </Badge>
              )}
              <h3 className="text-xl font-bold text-foreground">{plan.label}</h3>
              <div className="mt-2">
                <span className="text-3xl font-extrabold text-foreground">{plan.price}</span>
                {plan.priceNote && <span className="text-sm ml-1 text-muted-foreground">{plan.priceNote}</span>}
              </div>
              <p className="text-metadata mt-1">Up to {plan.maxUsers} users</p>
            </div>

            <div className="flex-1 px-6 py-5 space-y-3">
              {plan.features.map((f) => (
                <div key={f.label} className="flex items-center gap-2.5">
                  {f.included ? (
                    <Check className="w-4 h-4 shrink-0" style={{ color: ACCENT }} />
                  ) : (
                    <X className="w-4 h-4 shrink-0 text-muted-foreground/40" />
                  )}
                  <span className={`text-sm ${f.included ? "text-foreground" : "text-muted-foreground/50"}`}>{f.label}</span>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-6" style={{ backgroundColor: `${ACCENT}0d`, borderColor: `${ACCENT}33` }}>
        <h3 className="text-sm font-semibold mb-2" style={{ color: ACCENT }}>
          How plan assignment works
        </h3>
        <ul className="space-y-1.5 text-sm text-foreground/80">
          <li className="flex items-start gap-2">
            <span style={{ color: ACCENT }}>&#8594;</span>
            Plans are assigned per institution from the Institutions page, on that institution&apos;s Details tab.
          </li>
          <li className="flex items-start gap-2">
            <span style={{ color: ACCENT }}>&#8594;</span>
            Changes are applied immediately — no restart needed.
          </li>
          <li className="flex items-start gap-2">
            <span style={{ color: ACCENT }}>&#8594;</span>
            Institution admins see feature availability based on their assigned plan.
          </li>
        </ul>
      </Card>
    </div>
  );
}
