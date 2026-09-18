/**
 * Applies the saved theme before first paint to avoid a flash. Inline, so it carries
 * the CSP nonce. Only ever writes data-theme="light|dark" or removes it (system).
 */
export function ThemeScript({ nonce }: { nonce?: string }) {
  const code = `try{var t=localStorage.getItem("voya-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t;}catch(e){}`;
  return <script nonce={nonce} dangerouslySetInnerHTML={{ __html: code }} />;
}
