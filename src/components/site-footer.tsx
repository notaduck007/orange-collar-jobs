import { Link } from "@tanstack/react-router";
import { HardHat } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSiteSettings } from "@/lib/site-settings";
import { LanguageToggle } from "@/components/language-toggle";

const POPULAR_CITIES: Array<{ label: string; slug: string }> = [
  { label: "Warehouse Jobs in Dallas, TX", slug: "dallas-tx" },
  { label: "Warehouse Jobs in Columbus, OH", slug: "columbus-oh" },
  { label: "Warehouse Jobs in Indianapolis, IN", slug: "indianapolis-in" },
  { label: "Warehouse Jobs in Memphis, TN", slug: "memphis-tn" },
  { label: "Warehouse Jobs in Phoenix, AZ", slug: "phoenix-az" },
];

export function SiteFooter() {
  const { settings } = useSiteSettings();
  const { t } = useTranslation();
  return (
    <footer className="mt-24 bg-[color:var(--charcoal)] text-white">
      <div className="hazard-stripes h-2 w-full" />
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3 lg:grid-cols-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              {settings.branding.logo_url ? (
                <img src={settings.branding.logo_url} alt="" className="h-5 w-5 object-contain" />
              ) : (
                <HardHat className="h-5 w-5" strokeWidth={2.5} />
              )}
            </div>
            <span className="text-base font-bold tracking-tight">
              Warehouse<span className="text-primary">jobs.com</span>
            </span>
          </div>
          <p className="mt-3 max-w-xs text-sm text-white/60">{t("footer.tagline")}</p>
          <div className="mt-4">
            <LanguageToggle variant="footer" />
          </div>
        </div>
        <div>
          <p className="label-caps mb-3 text-white/50">{t("footer.forWorkers")}</p>
          <ul className="space-y-2 text-sm text-white/80">
            <li>
              <Link to="/jobs" className="hover:text-primary">
                {t("footer.browseJobs")}
              </Link>
            </li>
            <li>
              <Link to="/auth" search={{ mode: "signup" }} className="hover:text-primary">
                {t("footer.createAlerts")}
              </Link>
            </li>
            <li>
              <Link to="/faq" className="hover:text-primary">
                {t("common.faq")}
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="label-caps mb-3 text-white/50">{t("footer.forEmployers")}</p>
          <ul className="space-y-2 text-sm text-white/80">
            <li>
              <Link to="/pricing" className="hover:text-primary">
                {t("footer.postJob")}
              </Link>
            </li>
            <li>
              <Link to="/pricing" className="hover:text-primary">
                {t("footer.packages")}
              </Link>
            </li>
            <li>
              <Link to="/contact" className="hover:text-primary">
                {t("footer.talkSales")}
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="label-caps mb-3 text-white/50">{t("footer.company")}</p>
          <ul className="space-y-2 text-sm text-white/80">
            <li>
              <Link to="/mission" className="hover:text-primary">
                {t("common.mission")}
              </Link>
            </li>
            <li>
              <Link to="/about" className="hover:text-primary">
                {t("common.about")}
              </Link>
            </li>
            <li>
              <Link to="/contact" className="hover:text-primary">
                {t("common.contact")}
              </Link>
            </li>
            <li>
              <Link to="/privacy" className="hover:text-primary">
                {t("footer.privacy")}
              </Link>
            </li>
            <li>
              <a href={`mailto:${settings.branding.support_email}`} className="hover:text-primary">
                {settings.branding.support_email}
              </a>
            </li>
          </ul>
        </div>
        <div>
          <p className="label-caps mb-3 text-white/50">{t("footer.popularSearches")}</p>
          <ul className="space-y-2 text-sm text-white/80">
            <li>
              <Link
                to="/jobs/category/$categorySlug"
                params={{ categorySlug: "forklift-operator" }}
                className="hover:text-primary"
              >
                {t("footer.forkliftJobs")}
              </Link>
            </li>
            <li>
              <Link
                to="/jobs/category/$categorySlug"
                params={{ categorySlug: "picker-packer" }}
                className="hover:text-primary"
              >
                {t("footer.pickerJobs")}
              </Link>
            </li>
            <li>
              <Link
                to="/jobs/category/$categorySlug"
                params={{ categorySlug: "shipping-receiving" }}
                className="hover:text-primary"
              >
                {t("footer.shippingJobs")}
              </Link>
            </li>
            <li>
              <Link
                to="/jobs/category/$categorySlug"
                params={{ categorySlug: "order-selector" }}
                className="hover:text-primary"
              >
                {t("footer.selectorJobs")}
              </Link>
            </li>
            <li>
              <Link
                to="/jobs/category/$categorySlug"
                params={{ categorySlug: "warehouse-associate" }}
                className="hover:text-primary"
              >
                {t("footer.associateJobs")}
              </Link>
            </li>
            {POPULAR_CITIES.map((c) => (
              <li key={c.slug}>
                <Link
                  to="/warehouse-jobs/$citySlug"
                  params={{ citySlug: c.slug }}
                  className="hover:text-primary"
                >
                  {c.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-white/50 sm:flex-row sm:px-6">
          <p>
            © {new Date().getFullYear()} {settings.branding.site_name}. {t("footer.rights")}
          </p>
          <p>{t("footer.tagline")}</p>
        </div>
      </div>
    </footer>
  );
}
