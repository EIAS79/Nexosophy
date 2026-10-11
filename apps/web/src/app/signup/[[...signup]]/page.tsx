import { OwnedAuthForm } from "../../../components/owned-auth-form";

export default function SignupPage() {
  return (
    <main className="auth-shell" id="main-content">
      <div className="auth-shell__context">
        <a className="brand" href="/">
          Nexosophy
        </a>
        <p className="eyebrow">Create an account</p>
        <h1>Build your connected workspace.</h1>
        <p>Your credentials and sessions belong to Nexosophy's own authentication service.</p>
      </div>
      <div className="auth-shell__provider">
        <OwnedAuthForm mode="signup" />
      </div>
    </main>
  );
}
