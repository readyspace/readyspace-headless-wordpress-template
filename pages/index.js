export default function HomePage() {
  return (
    <main className="container">
      <p className="label">ReadySpace Headless WordPress POC</p>
      <h1>The Next.js frontend is running</h1>
      <p>This page is generated directly by Next.js.</p>
      <p>The test post below is retrieved from WordPress through WPGraphQL.</p>
      <p><a href="/headless-wordpress-test/">Open the WordPress test post</a></p>
    </main>
  );
}
