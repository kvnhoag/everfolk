import "./admin.css";

export default function AdminAccessDenied() {
  return <main className="admin-access">
    <a href="/" className="admin-home-link">← Return to your life</a>
    <p className="admin-eyebrow">EVERFOLK · CONTENT STUDIO</p>
    <h1>Admin access required.</h1>
    <p>You can play the game. An authorised admin account is required to edit worlds, events and routes.</p>
    <a className="admin-button" href="/signin-with-chatgpt?return_to=%2Fadmin" target="_top">Sign in with an admin account</a>
  </main>;
}
