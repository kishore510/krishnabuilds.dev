export const SOURCE_URL = "https://github.com/kishore510/krishnabuilds.dev";
// Until the Portal has its own page, "How this is built" opens the decision log on GitHub.
export const HOW_URL = `${SOURCE_URL}/blob/main/docs/decisions.md`;

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
      </ul>
      <p>Built with React and Vite, hosted on Cloudflare. System fonts.</p>
      <p>No ads, no tracking and no analytics.</p>
      <p>Personal projects, not financial advice.</p>
    </footer>
  );
}
