import { ButtonLink } from "@nexosophy/ui";

import { publicNavigation } from "../lib/navigation";

export function MarketingHeader() {
  return (
    <header className="marketing-header">
      <div className="marketing-header__inner">
        <a className="brand" href="/" aria-label="Nexosophy home">
          <span className="brand__mark" aria-hidden="true">N</span>
          <span>Nexosophy</span>
        </a>

        <nav className="marketing-header__nav" aria-label="Primary">
          {publicNavigation.map((item) => (
            <a key={item.href} href={item.href}>{item.label}</a>
          ))}
        </nav>

        <div className="marketing-header__actions">
          <ButtonLink href="/sign-in" variant="ghost" size="sm">Sign in</ButtonLink>
          <ButtonLink href="/sign-up" size="sm">Start free</ButtonLink>
        </div>

        <details className="marketing-header__mobile">
          <summary aria-label="Open navigation">Menu</summary>
          <nav aria-label="Mobile primary navigation">
            {publicNavigation.map((item) => (
              <a key={item.href} href={item.href}>{item.label}</a>
            ))}
            <a href="/sign-in">Sign in</a>
            <a href="/sign-up">Start free</a>
          </nav>
        </details>
      </div>
    </header>
  );
}
