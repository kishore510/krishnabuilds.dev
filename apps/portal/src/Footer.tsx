export const SOURCE_URL = "https://github.com/kishore510/krishnabuilds.dev";
export const HOW_URL = "/how-this-is-built";
// A Cloudflare Email Routing alias that forwards to the owner; it can be switched off there if it attracts spam.
export const CONTACT_URL = "mailto:hello@krishnabuilds.dev";

export function Footer() {
  return (
    <footer className="footer">
      <ul className="footer__links">
        <li>
          <a href={SOURCE_URL}>Source on GitHub</a>
        </li>
        <li>
          <a href={HOW_URL}>How this is built</a>
        </li>
        <li>
          <a href={CONTACT_URL}>Contact</a>
        </li>
      </ul>
      <p>Built with React and Vite, hosted on Cloudflare. System fonts.</p>
      <p>No ads, no tracking and no analytics.</p>
      <p>Personal projects, not financial advice.</p>
    </footer>
  );
}
