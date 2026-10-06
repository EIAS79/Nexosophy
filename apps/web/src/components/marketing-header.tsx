import { ButtonLink } from "@nexosophy/ui";

export function MarketingHeader() {
  const primary = [
    { href: "/features", label: "Product", menu: true },
    { href: "/students", label: "For", menu: true },
    { href: "/templates", label: "Resources", menu: true },
    { href: "/pricing", label: "Pricing", menu: false },
  ] as const;

  return (
    <header className="marketing-header">
      <div className="marketing-header__inner">
        <a className="brand" href="/" aria-label="Nexosophy home">
          <span className="brand__mark" aria-hidden="true">N</span>
          <span>Nexosophy</span>
        </a>

        <nav className="marketing-header__nav" aria-label="Primary">
          {primary.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
              {item.menu ? <span aria-hidden="true">⌄</span> : null}
            </a>
          ))}
        </nav>

        <a className="marketing-header__search" href="/app/search" aria-label="Search Nexosophy">
          <span aria-hidden="true">⌕</span>
          <span>Search knowledge, files, people...</span>
          <kbd>⌘ K</kbd>
        </a>

        <div className="marketing-header__actions">
          <ButtonLink href="/login" variant="ghost" size="sm">Sign in</ButtonLink>
          <ButtonLink href="/signup" size="sm">Get started</ButtonLink>
        </div>

        <details className="marketing-header__mobile">
          <summary aria-label="Open navigation">Menu</summary>
          <nav aria-label="Mobile primary navigation">
            {primary.map((item) => (
              <a key={item.href} href={item.href}>{item.label}</a>
            ))}
            <a href="/login">Sign in</a>
            <a href="/signup">Get started</a>
          </nav>
        </details>
      </div>
    </header>
  );
}
