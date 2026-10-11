import { OwnedAuthForm } from "../../../components/owned-auth-form";

export default function LoginPage() {
  return (
    <main className="auth-shell" id="main-content">
      <div className="auth-shell__context">
        <a className="brand" href="/">
          Nexosophy
        </a>
        <p className="eyebrow">Welcome back</p>
        <h1>Your workspace. Your identity.</h1>
        <p>Secure Nexosophy-managed sessions, with optional social sign-in and MFA.</p>
      </div>
      <div className="auth-shell__provider">
        <OwnedAuthForm mode="login" />
      </div>
    </main>
  );
}
