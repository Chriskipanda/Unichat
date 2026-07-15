"use client";

const PLANS = [
  {
    key: "starter",
    label: "Starter",
    price: "Free",
    priceNote: "No credit card required",
    bg: "bg-white",
    border: "border-green-200",
    headerBg: "bg-green-50",
    labelColor: "text-green-700",
    badgeBg: "bg-green-100 text-green-700",
    cta: "border-green-300 text-green-700 hover:bg-green-50",
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
    bg: "bg-white",
    border: "border-green-500 ring-2 ring-green-200",
    headerBg: "bg-gradient-to-r from-green-600 to-green-500",
    labelColor: "text-white",
    badgeBg: "bg-white/20 text-white",
    cta: "bg-green-600 text-white hover:bg-green-700",
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
    bg: "bg-green-950",
    border: "border-green-800",
    headerBg: "bg-green-900",
    labelColor: "text-green-100",
    badgeBg: "bg-green-800 text-green-200",
    cta: "bg-green-500 text-white hover:bg-green-400",
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

function Check({ ok, dark }: { ok: boolean; dark?: boolean }) {
  if (ok) {
    return (
      <svg className={`w-4 h-4 ${dark ? "text-green-400" : "text-green-600"}`} fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
      </svg>
    );
  }
  return (
    <svg className="w-4 h-4 text-green-300" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  );
}

export default function PlansPage() {
  return (
    <div className="space-y-8 max-w-6xl">
      {/* Heading */}
      <div>
        <h2 className="text-green-950 font-bold text-xl">Subscription Plans</h2>
        <p className="text-green-500 text-sm mt-1">
          Plan tiers determine feature access and user limits per institution. Changes take effect immediately.
        </p>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PLANS.map((plan) => {
          const isDark = plan.key === "enterprise";
          return (
            <div
              key={plan.key}
              className={`rounded-2xl border overflow-hidden shadow-sm flex flex-col ${plan.bg} ${plan.border}`}
            >
              {/* Header */}
              <div className={`${plan.headerBg} px-6 py-5`}>
                {plan.popular && (
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full mb-3 inline-block ${plan.badgeBg}`}>
                    Most Popular
                  </span>
                )}
                <h3 className={`text-xl font-bold ${plan.labelColor}`}>{plan.label}</h3>
                <div className="mt-2">
                  <span className={`text-3xl font-extrabold ${plan.labelColor}`}>{plan.price}</span>
                  {plan.priceNote && (
                    <span className={`text-sm ml-1 ${isDark ? "text-green-500" : "text-green-400"}`}>
                      {plan.priceNote}
                    </span>
                  )}
                </div>
                <p className={`text-xs mt-1 ${isDark ? "text-green-600" : "text-green-400"}`}>
                  Up to {plan.maxUsers} users
                </p>
              </div>

              {/* Features */}
              <div className="flex-1 px-6 py-5 space-y-3">
                {plan.features.map((f) => (
                  <div key={f.label} className="flex items-center gap-2.5">
                    <Check ok={f.included} dark={isDark} />
                    <span
                      className={`text-sm ${
                        f.included
                          ? isDark ? "text-green-200" : "text-green-900"
                          : isDark ? "text-green-700" : "text-green-300"
                      }`}
                    >
                      {f.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <div className="px-6 pb-6">
                <button
                  className={`w-full py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors ${plan.cta}`}
                >
                  {plan.key === "enterprise" ? "Contact Sales" : `Assign ${plan.label} Plan`}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Feature comparison note */}
      <div className="bg-green-50 border border-green-200 rounded-2xl px-6 py-5">
        <h3 className="text-green-800 font-semibold text-sm mb-2">How plan assignment works</h3>
        <ul className="space-y-1.5 text-green-700 text-sm">
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">&#8594;</span>
            Plans are assigned per institution from the Institutions page or via the plan selector in each row.
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">&#8594;</span>
            Changes are applied immediately — no restart needed.
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">&#8594;</span>
            Institution admins see feature availability based on their assigned plan.
          </li>
        </ul>
      </div>
    </div>
  );
}
