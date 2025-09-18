// src/pages/Landing.jsx
import React from "react";
import { Link } from "react-router-dom";

/* Inline SVG icons (small, lightweight) */
const IconBox = () => (
  <svg width="42" height="42" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="3" width="18" height="18" rx="3" stroke="white" strokeWidth="1.5" />
  </svg>
);
const IconTruck = () => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 7h11v8H3z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M20 11h-3v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="7.5" cy="18.5" r="1.5" fill="currentColor"/>
    <circle cx="18.5" cy="18.5" r="1.5" fill="currentColor"/>
  </svg>
);
const IconBoxSmall = () => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M21 16V8a1 1 0 0 0-.553-.894l-7-3.5a1 1 0 0 0-.894 0l-7 3.5A1 1 0 0 0 4 8v8a1 1 0 0 0 .553.894l7 3.5a1 1 0 0 0 .894 0l7-3.5A1 1 0 0 0 21 16z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconClock = () => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M12 7v6l4 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const IconShield = () => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 3l7 3v5c0 5-3.5 9.5-7 11-3.5-1.5-7-6-7-11V6l7-3z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export default function Landing() {
  return (
    <div className="w-full">
      {/* HERO */}
      <section className="bg-[#07107a] text-white pt-20 pb-16">
        <div className="container mx-auto text-center px-4">
          <h1 className="text-5xl md:text-6xl font-extrabold">Sri Gopal Traders</h1>
          <p className="mt-6 text-lg md:text-xl max-w-3xl mx-auto leading-relaxed text-white/90">
            Your trusted partner for authentic Haldiram products. Serving retailers, restaurants, and institutions with premium quality snacks, sweets, and ready-to-eat foods.
          </p>
        </div>
      </section>

      {/* STATS */}
      <section className="bg-white -mt-10">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center items-center">
            <div>
              <div className="text-4xl font-extrabold text-[#07107a]">500+</div>
              <div className="mt-2 text-sm text-gray-500">Happy Clients</div>
            </div>
            <div>
              <div className="text-4xl font-extrabold text-[#07107a]">50+</div>
              <div className="mt-2 text-sm text-gray-500">Product Varieties</div>
            </div>
            <div>
              <div className="text-4xl font-extrabold text-[#07107a]">10+</div>
              <div className="mt-2 text-sm text-gray-500">Years Experience</div>
            </div>
            <div>
              <div className="text-4xl font-extrabold text-[#07107a]">24/7</div>
              <div className="mt-2 text-sm text-gray-500">Customer Support</div>
            </div>
          </div>
        </div>
      </section>

      {/* PRODUCT RANGE */}
      <section className="bg-gray-50 py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-extrabold">Our Product Range</h2>
          <p className="mt-3 text-gray-500 max-w-2xl mx-auto">
            Discover the complete range of authentic Haldiram products including namkeen, sweets, papad, and ready-to-eat meals.
          </p>

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { title: "Haldiram Namkeen Mix", cat: "Namkeen", desc: "Traditional savory snacks mix" },
              { title: "Haldiram Sweets", cat: "Sweets", desc: "Premium quality Indian sweets" },
              { title: "Haldiram Papad", cat: "Papad", desc: "Crispy papad varieties" },
              { title: "Haldiram Ready-to-Eat", cat: "Ready-to-Eat", desc: "Convenient meal solutions" },
            ].map((p) => (
              <article key={p.title} className="bg-white rounded-2xl shadow-md overflow-hidden">
                <div className="h-44 bg-[#07107a] flex items-center justify-center">
                  <div className="text-white">
                    <IconBox />
                  </div>
                </div>
                <div className="p-6 text-left">
                  <div className="text-sm text-[#07107a] font-semibold">{p.cat}</div>
                  <h3 className="mt-2 text-lg font-semibold text-gray-900">{p.title}</h3>
                  <p className="mt-2 text-sm text-gray-500">{p.desc}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* WHY CHOOSE US */}
      <section className="py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-extrabold">Why Choose Us</h2>
          <p className="mt-3 text-gray-500 max-w-2xl mx-auto">We provide comprehensive distribution services with a focus on quality, reliability, and customer satisfaction.</p>

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="flex flex-col items-center">
              <div className="bg-[#07107a] text-white p-5 rounded-full">
                <IconTruck />
              </div>
              <h4 className="mt-4 font-semibold">Bulk Supply</h4>
              <p className="mt-2 text-sm text-gray-500 max-w-xs">Reliable bulk supply to retailers, restaurants, and institutions</p>
            </div>

            <div className="flex flex-col items-center">
              <div className="bg-[#07107a] text-white p-5 rounded-full">
                <IconBoxSmall />
              </div>
              <h4 className="mt-4 font-semibold">Quality Assurance</h4>
              <p className="mt-2 text-sm text-gray-500 max-w-xs">All products meet Haldiram's strict quality standards</p>
            </div>

            <div className="flex flex-col items-center">
              <div className="bg-[#07107a] text-white p-5 rounded-full">
                <IconClock />
              </div>
              <h4 className="mt-4 font-semibold">Fast Delivery</h4>
              <p className="mt-2 text-sm text-gray-500 max-w-xs">Quick and efficient delivery across the region</p>
            </div>

            <div className="flex flex-col items-center">
              <div className="bg-[#07107a] text-white p-5 rounded-full">
                <IconShield />
              </div>
              <h4 className="mt-4 font-semibold">Genuine Products</h4>
              <p className="mt-2 text-sm text-gray-500 max-w-xs">100% authentic Haldiram products with warranty</p>
            </div>
          </div>
        </div>
      </section>

      {/* ABOUT + BLUE CALLOUT */}
      <section className="bg-white py-16">
        <div className="container mx-auto px-4 grid lg:grid-cols-2 gap-10 items-center">
          <div>
            <h3 className="text-3xl font-extrabold">About Our Distribution</h3>
            <p className="mt-4 text-gray-600">
              We are an authorized distributor of Haldiram products, serving the region with authentic and high-quality food products. With years of experience in the food distribution industry, we understand the needs of our customers and provide reliable service.
            </p>

            <ul className="mt-6 space-y-4 text-gray-600">
              <li className="flex items-start gap-3"><span className="text-[#07107a]">🔹</span> Authorized Haldiram Distributor</li>
              <li className="flex items-start gap-3"><span className="text-[#07107a]">🔹</span> Customer-Focused Service</li>
              <li className="flex items-start gap-3"><span className="text-[#07107a]">🔹</span> Quality Guaranteed Products</li>
            </ul>
          </div>

          <div>
            <div className="bg-[#07107a] text-white rounded-2xl p-8 flex flex-col items-center justify-center">
              <div className="text-4xl mb-4">👥</div>
              <h4 className="text-xl font-semibold text-yellow-300">Serving Since 2014</h4>
              <p className="mt-3 text-center max-w-xs text-white/90">Trusted by hundreds of businesses across the region for their Haldiram product needs.</p>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="bg-gray-50 py-16">
        <div className="container mx-auto px-4 text-center">
          <h3 className="text-3xl font-extrabold">What Our Customers Say</h3>
          <p className="mt-3 text-gray-500 max-w-2xl mx-auto">Don't just take our word for it. Here's what our valued customers have to say about our service.</p>

          <div className="mt-8 grid sm:grid-cols-3 gap-6">
            {[
              { name: "Rajesh Kumar", role: "Restaurant Owner", quote: "Excellent service and genuine products. Highly recommended." },
              { name: "Priya Sharma", role: "Retail Store Owner", quote: "Wide variety and fast delivery — a dependable partner." },
              { name: "Amit Patel", role: "Catering Business", quote: "Quality is top-notch. Makes bulk orders easy and reliable." },
            ].map((t) => (
              <div key={t.name} className="bg-white rounded-xl p-6 shadow-sm text-left">
                <div className="text-yellow-400 mb-3">★★★★★</div>
                <p className="text-gray-700">“{t.quote}”</p>
                <div className="mt-4 font-semibold text-gray-900">{t.name}</div>
                <div className="text-sm text-gray-500">{t.role}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT — big blue section */}
      <section className="bg-[#07107a] text-white py-16">
        <div className="container mx-auto px-4 text-center">
          <h3 className="text-3xl md:text-4xl font-extrabold">Get In Touch</h3>
          <p className="mt-3 max-w-2xl mx-auto text-white/90">Ready to partner with us? Contact us today for bulk orders, pricing, and more information.</p>

          <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-8">
            <div>
              <div className="flex flex-col items-center">
                <div className="bg-white/10 rounded-full p-4 mb-4"><svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M3 5h18" stroke="white" strokeWidth="1.5"/></svg></div>
                <div className="font-semibold">Phone</div>
                <div className="mt-2 text-sm">+91 98765 43210<br/>+91 98765 43211</div>
              </div>
            </div>

            <div>
              <div className="flex flex-col items-center">
                <div className="bg-white/10 rounded-full p-4 mb-4"><svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M3 8l8 5 8-5" stroke="white" strokeWidth="1.5"/></svg></div>
                <div className="font-semibold">Email</div>
                <div className="mt-2 text-sm">info@haldiramdistributor.com<br/>orders@haldiramdistributor.com</div>
              </div>
            </div>

            <div>
              <div className="flex flex-col items-center">
                <div className="bg-white/10 rounded-full p-4 mb-4"><svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M12 2C8 2 4 5.2 4 9c0 5.3 8 13 8 13s8-7.7 8-13c0-3.8-4-7-8-7z" stroke="white" strokeWidth="1.5"/></svg></div>
                <div className="font-semibold">Address</div>
                <div className="mt-2 text-sm">123 Food Street, Market Area<br/>City, State - 123456</div>
              </div>
            </div>
          </div>

          <div className="mt-10">
            <Link to="/contact" className="inline-block bg-white text-[#07107a] px-6 py-3 rounded-full font-semibold">Send Message</Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#0f1720] text-white pt-12 pb-8">
        <div className="container mx-auto px-4 grid md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-3">
              <div className="bg-yellow-400 text-[#07107a] rounded p-2">🏬</div>
              <div className="font-semibold text-lg">Haldiram Distributor</div>
            </div>
            <p className="mt-4 text-gray-300 text-sm">Authorized distributor of Haldiram products, serving retailers, restaurants, and institutions with premium quality snacks, sweets, and ready-to-eat foods across the region.</p>
            <div className="mt-4 text-gray-300 space-y-2 text-sm">
              <div>✉️ info@haldiramdistributor.com</div>
              <div>📞 +91 98765 43210</div>
              <div>📍 123 Food Street, Market Area, City, State - 123456</div>
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Product</h4>
            <ul className="text-gray-300 space-y-2 text-sm">
              <li>Namkeen</li>
              <li>Sweets</li>
              <li>Papad</li>
              <li>Ready-to-Eat</li>
              <li>Bulk Orders</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Support</h4>
            <ul className="text-gray-300 space-y-2 text-sm">
              <li>Documentation</li>
              <li>Contact Support</li>
              <li>Training Videos</li>
              <li>API Reference</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-4">Company</h4>
            <ul className="text-gray-300 space-y-2 text-sm">
              <li>About Us</li>
              <li>Careers</li>
              <li>Privacy Policy</li>
              <li>Terms of Service</li>
            </ul>
          </div>
        </div>

        <div className="container mx-auto px-4 mt-8 border-t border-white/6 pt-6 text-gray-400 text-sm">
          © 2025 Haldiram Distributor. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
