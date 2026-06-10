import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Languages } from "lucide-react";
import { getStoredLang, setLang, type Lang } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  variant?: "header" | "footer";
}

export function LanguageToggle({ variant = "header" }: Props) {
  const { i18n } = useTranslation();
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const stored = getStoredLang();
    setLangState(stored);
    setLang(stored);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !user) return;
    void supabase
      .from("profiles")
      .select("language")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        const profLang = data?.language === "es" ? "es" : "en";
        if (profLang !== getStoredLang()) {
          setLangState(profLang);
          setLang(profLang);
        }
      });
  }, [user, mounted]);

  const onChange = (next: Lang) => {
    setLangState(next);
    setLang(next);
    if (user) {
      void supabase.from("profiles").update({ language: next }).eq("id", user.id);
    }
  };

  // Render a stable shell during SSR to avoid hydration mismatch
  const current = mounted ? lang : "en";

  const dark = variant === "footer";
  const base = dark
    ? "border-white/15 text-white/80 hover:text-white"
    : "border-border text-[color:var(--ink)] hover:text-primary";
  const active = dark
    ? "bg-white text-[color:var(--ink)]"
    : "bg-primary text-primary-foreground";

  return (
    <div
      className={`inline-flex items-center gap-0.5 rounded-md border ${base} bg-transparent p-0.5 text-xs font-semibold`}
      role="group"
      aria-label={i18n.t("common.language") as string}
    >
      <Languages
        className={`ml-1 mr-0.5 h-3.5 w-3.5 ${dark ? "text-white/60" : "text-muted-foreground"}`}
        aria-hidden="true"
      />
      {(["en", "es"] as const).map((code) => (
        <button
          key={code}
          type="button"
          aria-pressed={current === code}
          onClick={() => onChange(code)}
          className={`rounded-sm px-2 py-0.5 transition-colors ${
            current === code ? active : ""
          }`}
        >
          {code === "en" ? "EN" : "ES"}
        </button>
      ))}
    </div>
  );
}
