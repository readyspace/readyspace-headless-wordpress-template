# ReadySpace WebSpace Headless WordPress Starter

This repository is a starter template for building a **headless WordPress website** on **ReadySpace WebSpace Premium**.

In this setup:

- WordPress is the content management system.
- WPGraphQL sends WordPress content through an API.
- Faust.js connects WordPress to the frontend.
- Next.js displays the website visitors see.
- ReadySpace WebSpace runs both WordPress and the Node.js frontend.

> [!IMPORTANT]
> This setup requires a **ReadySpace WebSpace Premium** plan.  
> WebSpace plans without the word **“Premium”** in the plan name do not include the required **Node.js Selector** and **Terminal** features.

---

## 1. What You Will Build

A finished setup normally looks like this:

```text
Visitors
   |
   v
https://brightpath.example
Next.js + Faust.js frontend
Running as a Node.js application
   |
   | WPGraphQL
   v
https://cms.brightpath.example
WordPress backend
```

Example using the fictional BrightPath business:

```text
Frontend website: https://brightpath.example
WordPress admin:   https://cms.brightpath.example/wp-admin
GraphQL endpoint:  https://cms.brightpath.example/graphql
```

Visitors use the frontend website. Editors log in to the WordPress backend to create pages and posts.

---

## 2. Who This Guide Is For

This guide is written for a beginner developer who knows how to:

- Log in to cPanel.
- Log in to WordPress.
- Use GitHub.
- Copy and paste commands into Terminal.
- Edit a text file.

You do not need to build the project from an empty folder. This template already contains the basic Faust.js and Next.js files.

---

## 3. Check Your ReadySpace Plan First

Before doing anything else, log in to cPanel.

Look for your package or plan name under **General Information**.

Your plan name must contain:

```text
Premium
```

Examples that should support this setup:

```text
WebSpace Premium
WebSpace Premium Pro
WebSpace Premium Ultimate
```

A plan without the word `Premium` does not include the required Node.js and Terminal features.

Also confirm that cPanel contains both of these tools:

```text
Terminal
Setup Node.js App
```

The Node.js tool may also appear as:

```text
Node.js Selector
```

Stop here when:

- Your plan name does not contain `Premium`.
- Terminal is missing.
- Setup Node.js App or Node.js Selector is missing.

Upgrade to a supported ReadySpace WebSpace Premium plan before continuing.

---

## 4. What You Need Before Starting

Prepare the following:

- A ReadySpace WebSpace Premium account.
- Access to the account’s cPanel.
- A domain name connected to the WebSpace account.
- A GitHub account with access to this template.
- Permission to create a new GitHub repository.
- A WordPress administrator login.
- About 30 to 60 minutes for the first basic setup.

Choose two addresses:

```text
Frontend: https://brightpath.example
Backend:  https://cms.brightpath.example
```

`BrightPath` is a fictional example used throughout this guide.

Use these example values while learning:

```text
Example business:       BrightPath
Frontend website:       https://brightpath.example
WordPress backend:      https://cms.brightpath.example
GitHub repository:      brightpath-headless-wordpress
cPanel application root: brightpath-headless
```

When setting up a real website, replace `brightpath` and `brightpath.example` with the real client name and domain.

---

## 5. Important Safety Rules

Never upload these items to GitHub:

```text
.env
.env.local
Passwords
Faust secret keys
WordPress application passwords
SSH private keys
API tokens
node_modules
.next
Log files
```

This template already ignores common secret, build and temporary files through `.gitignore`.

Only copy a **public SSH key** ending in `.pub` into GitHub. Never copy or share the matching private key.

Do not send your cPanel password, WordPress password or Faust secret key in a support ticket, chat message or screenshot.

---

# Part A — Create Your Own Project from the Template

## 6. Do Not Develop Inside the Master Template

The master template is:

```text
readyspace/readyspace-headless-wordpress-template
```

Do not place client-specific content, passwords, domains or branding inside the master template.

Create one separate repository for every website.

Examples:

```text
readyspace/brightpath-headless-wordpress
readyspace/example-company-headless-wordpress
readyspace/my-first-headless-wordpress
```

---

## 7. Create a New Repository from the Template

On GitHub:

1. Open `readyspace/readyspace-headless-wordpress-template`.
2. Click **Use this template**.
3. Click **Create a new repository**.
4. Select the correct owner.
5. Enter a repository name.

Example:

```text
brightpath-headless-wordpress
```

6. Select **Private** unless the source code is meant to be public.
7. Do not include every branch unless your team specifically needs them.
8. Click **Create repository**.

You now have a separate repository for the website.

Changes made in this new repository will not change the master template.

---

## 8. Clone the New Repository to Your Computer

Using GitHub Desktop:

1. Open GitHub Desktop.
2. Click **File → Clone Repository**.
3. Select the new client repository.
4. Choose a local folder.
5. Click **Clone**.

Do not clone the master template for normal client work. Clone the new repository created from the template.

---

## 9. Rename the Project in `package.json`

Open `package.json`.

Change:

```json
"name": "headless-faust-test"
```

to a simple project name using lowercase letters and hyphens:

```json
"name": "brightpath-headless-wordpress"
```

Do not use spaces in the package name.

Save the file, commit the change in GitHub Desktop and push it to GitHub.

---

# Part B — Prepare the WordPress Backend

## 10. Create the WordPress Backend Address

In cPanel, create a subdomain such as:

```text
cms.brightpath.example
```

Use this subdomain only for WordPress.

Make sure the subdomain has a valid SSL certificate so it opens with:

```text
https://cms.brightpath.example
```

Do not continue while the browser shows a certificate warning.

---

## 11. Install WordPress

Use the WordPress installer available in cPanel, such as WP Toolkit.

Install WordPress at:

```text
https://cms.brightpath.example
```

After installation, log in at:

```text
https://cms.brightpath.example/wp-admin
```

Use a strong administrator password.

---

## 12. Set WordPress Permalinks

In WordPress:

1. Go to **Settings → Permalinks**.
2. Select **Post name**, or another non-Plain structure.
3. Click **Save Changes**.

Do not use the **Plain** permalink setting.

---

## 13. Install the Required WordPress Plugins

In WordPress:

1. Go to **Plugins → Add New Plugin**.
2. Search for `WPGraphQL`.
3. Install and activate it.
4. Search for `Faust.js`.
5. Install and activate the Faust.js WordPress plugin.

Both plugins must be active:

```text
WPGraphQL
Faust.js
```

WPGraphQL provides the content API. Faust.js connects that API to the Next.js frontend.

---

## 14. Test WPGraphQL

Open:

```text
https://cms.brightpath.example/graphql
```

You can also open the GraphiQL IDE from the WordPress admin bar.

Run this test query:

```graphql
query TestConnection {
  generalSettings {
    title
    url
  }
}
```

A successful result looks similar to:

```json
{
  "data": {
    "generalSettings": {
      "title": "My Website",
      "url": "https://cms.brightpath.example"
    }
  }
}
```

Fix the WordPress or WPGraphQL setup before continuing when the endpoint does not work.

---

## 15. Enable Public Introspection Temporarily

Faust.js uses the WordPress GraphQL schema to create `possibleTypes.json`.

In WordPress:

1. Go to **GraphQL → Settings**.
2. Find **Enable Public Introspection**.
3. Enable it.
4. Save the settings.

You need this enabled when running:

```bash
npm run generate
```

After generation is complete, your team may review whether introspection should remain enabled for the finished production site.

---

## 16. Configure Faust.js in WordPress

In WordPress:

1. Go to **Settings → Faust**.
2. Set the frontend site URL.

Example:

```text
https://brightpath.example
```

3. Save the settings.
4. Find the **Secret Key**.
5. Copy the secret key to a safe place.

Do not show the secret key in screenshots and do not commit it to GitHub.

Leave optional redirect behaviour disabled until the frontend is working. This makes troubleshooting easier.

---

# Part C — Give cPanel Read-Only Access to GitHub

## 17. Why cPanel Needs a Deploy Key

The new client repository should normally be private.

Your cPanel account therefore needs permission to read it. A GitHub deploy key gives one cPanel account access to one repository.

Use read-only access unless the server must push changes back to GitHub.

---

## 18. Create an SSH Key in cPanel Terminal

Open **cPanel → Terminal**.

Run:

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh

ssh-keygen -t ed25519 \
  -C "readyspace-webspace-deploy" \
  -f ~/.ssh/id_ed25519_github \
  -N ""
```

Display the public key:

```bash
cat ~/.ssh/id_ed25519_github.pub
```

Copy the entire line beginning with:

```text
ssh-ed25519
```

Do not display, copy or share this private-key file:

```text
~/.ssh/id_ed25519_github
```

---

## 19. Add the Public Key to the Client Repository

In the new client repository on GitHub:

1. Open **Settings**.
2. Open **Deploy keys**.
3. Click **Add deploy key**.
4. Enter a title.

Example:

```text
ReadySpace WebSpace production
```

5. Paste the public key copied from cPanel.
6. Leave **Allow write access** unchecked.
7. Save the deploy key.

This key should be added to the client repository, not to the master template.

---

## 20. Configure the GitHub SSH Connection

Return to cPanel Terminal.

Create an SSH configuration:

```bash
cat > ~/.ssh/config <<'EOF'
Host github-readyspace-site
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_ed25519_github
    IdentitiesOnly yes
EOF

chmod 600 ~/.ssh/config
```

Test the connection:

```bash
ssh -T git@github-readyspace-site
```

The first connection may ask whether you trust the server fingerprint.

Type:

```text
yes
```

A successful GitHub message normally says that authentication succeeded and shell access is not provided.

---

# Part D — Clone the Project into ReadySpace WebSpace

## 21. Choose the Application Folder

Choose a short application folder name.

Example:

```text
brightpath-headless
```

The full folder will become:

```text
/home/CPANEL_USERNAME/brightpath-headless
```

Do not place the application inside `public_html` unless ReadySpace support has specifically instructed you to do so.

---

## 22. Clone the Client Repository

In cPanel Terminal, go to your home folder:

```bash
cd ~
```

Clone the client repository:

```bash
git clone \
  git@github-readyspace-site:readyspace/CLIENT-REPOSITORY.git \
  APP-FOLDER
```

Example:

```bash
git clone \
  git@github-readyspace-site:readyspace/brightpath-headless-wordpress.git \
  brightpath-headless
```

Enter the folder:

```bash
cd ~/brightpath-headless
```

Confirm the files exist:

```bash
ls -la
```

You should see files and folders such as:

```text
.gitignore
app.js
faust.config.js
package.json
pages
styles
wp-templates
possibleTypes.json
```

---

# Part E — Add the Environment Settings

## 23. Create `.env.local`

Inside the application folder, create:

```text
.env.local
```

A beginner-friendly method is:

```bash
nano .env.local
```

Add:

```env
NEXT_PUBLIC_WORDPRESS_URL=https://cms.brightpath.example
FAUST_SECRET_KEY=PASTE_THE_SECRET_FROM_WORDPRESS_HERE
```

Replace both example values.

Save in `nano`:

```text
Control + O
Enter
Control + X
```

Protect the file:

```bash
chmod 600 .env.local
```

Confirm that Git is ignoring it:

```bash
git status
```

`.env.local` must not appear as an untracked or staged file.

---

# Part F — Create the Node.js Application

## 24. Open the Node.js Selector

In cPanel, open:

```text
Setup Node.js App
```

or:

```text
Node.js Selector
```

Click **Create Application**.

Use settings similar to these:

```text
Node.js version:  ReadySpace-supported LTS version
Application mode: Production
Application root: brightpath-headless
Application URL:  brightpath.example
Startup file:     app.js
```

Important:

- The Application root must match the cloned folder.
- The frontend domain must not be the WordPress backend subdomain.
- The Startup file must be `app.js`.
- Use a supported LTS Node.js version, not an experimental version.

Add this environment variable in the Node.js application screen when the option is available:

```text
NODE_ENV=production
```

Create or save the application.

---

## 25. Copy the Activation Command

After creating the Node.js application, cPanel displays a command similar to:

```bash
source /home/USERNAME/nodevenv/brightpath-headless/VERSION/bin/activate
```

Copy the exact command shown in your own cPanel account.

Do not copy the example blindly because the username, folder and Node.js version will be different.

---

# Part G — Install, Generate and Build

## 26. Activate the Node.js Environment

Open cPanel Terminal.

Paste the activation command shown by cPanel.

Then enter the project folder:

```bash
cd ~/brightpath-headless
```

Confirm Node.js and npm work:

```bash
node --version
npm --version
```

Both commands should return version numbers.

---

## 27. Install the Project Packages

Run:

```bash
npm install
```

This may take several minutes.

Do not close Terminal while it is running.

A successful installation returns to the normal command prompt without a fatal error.

---

## 28. Generate the WordPress GraphQL Types

Run:

```bash
npm run generate
```

This connects to the WordPress backend and updates:

```text
possibleTypes.json
```

When this fails, check:

- `NEXT_PUBLIC_WORDPRESS_URL` is correct.
- The WordPress site uses HTTPS.
- WPGraphQL is active.
- Public introspection is enabled.
- The GraphQL endpoint works.
- `.env.local` is inside the project root.

Do not edit `possibleTypes.json` manually.

---

## 29. Build the Frontend

Run:

```bash
npm run build
```

A successful build creates the `.next` folder.

The `.next` folder is a build output. It should not be committed to GitHub.

Do not run the site in development mode on the production WebSpace account.

---

## 30. Restart the Node.js Application

Return to **Setup Node.js App** in cPanel.

Click **Restart** for the application.

When a Restart button is not available, use:

```bash
cd ~/brightpath-headless
mkdir -p tmp
touch tmp/restart.txt
```

Passenger will start the application through:

```text
app.js
```

You normally do not need to leave `npm run start` running inside Terminal because cPanel’s Node.js application service manages the process.

---

# Part H — Test the Website

## 31. Open the Frontend

Open:

```text
https://brightpath.example
```

Confirm that:

- The page loads through HTTPS.
- The website shows WordPress content.
- A WordPress post URL opens on the frontend.
- The browser does not show a certificate warning.

Create a simple WordPress test post when needed.

Example title:

```text
Hello from ReadySpace Headless WordPress
```

Publish it, then open its matching frontend URL.

---

## 32. Final WordPress Faust Settings

After the frontend works:

1. Return to **WordPress → Settings → Faust**.
2. Confirm the frontend URL is correct.
3. Enable redirect or headless behaviour only when required.
4. Test WordPress login, page editing and post previews.

Do not lock yourself out of the WordPress admin area.

---

# Part I — Normal Development Workflow

## 33. Which Repository Should Be the Main Copy?

GitHub is the source of truth.

Use this direction:

```text
Developer computer
       |
       | Commit and push
       v
Client GitHub repository
       |
       | Pull and deploy
       v
ReadySpace WebSpace
```

Do not treat the cPanel copy as the only or main copy of the source code.

---

## 34. Make Code Changes Safely

Recommended workflow:

```text
feature branch
      |
      v
staging branch
      |
      v
main branch
      |
      v
production deployment
```

For a first small test site, you may begin with `main`. Production client sites should use staging and review before deployment.

---

## 35. Deploy a Future Update

After changes have been tested and pushed to GitHub, open cPanel Terminal.

Activate the Node.js environment using the command shown in cPanel.

Then run:

```bash
cd ~/brightpath-headless
git pull origin main
npm install
npm run build
mkdir -p tmp
touch tmp/restart.txt
```

Run this when the WordPress GraphQL schema changed:

```bash
npm run generate
npm run build
```

Schema changes can happen after installing or removing WordPress plugins, custom post types, GraphQL extensions or other GraphQL fields.

---

# Part J — Understand the Template Files

## 36. Main Files and Folders

### `app.js`

The cPanel Passenger startup file.

Do not rename it unless the Node.js application setting is updated too.

### `faust.config.js`

Connects the Faust template system, plugins and GraphQL type information.

### `package.json`

Contains the project name, packages and commands.

Available commands include:

```bash
npm run dev
npm run generate
npm run build
npm run start
```

### `pages/`

Contains Next.js pages and the Faust API route.

### `wp-templates/`

Contains templates that display WordPress content.

### `possibleTypes.json`

Generated from the WordPress GraphQL schema.

Do not edit it manually.

### `styles/`

Contains frontend styling.

### `.gitignore`

Prevents secrets, installed packages, build outputs and logs from being committed.

---

# Part K — Common Problems

## 37. “Terminal” or “Setup Node.js App” Is Missing

Cause:

```text
The WebSpace plan is not a Premium plan.
```

Check the package name in cPanel. The name must contain `Premium`.

---

## 38. GitHub Says “Permission Denied”

Check:

- The public deploy key was added to the correct client repository.
- The private key still exists in `~/.ssh/`.
- `~/.ssh/config` points to the correct private key.
- The clone URL uses the SSH alias from this guide.
- The deploy key was not accidentally added to the template repository.

Test again:

```bash
ssh -T git@github-readyspace-site
```

---

## 39. `npm: command not found`

The Node.js environment is not active.

Return to cPanel’s Node.js application page and copy the activation command again.

---

## 40. `npm run generate` Fails

Check:

```text
WPGraphQL is active
Faust.js is active
Public introspection is enabled
The WordPress URL is correct
The GraphQL endpoint works
.env.local exists
```

---

## 41. The Frontend Shows a 500 or 503 Error

Check:

- `npm install` completed.
- `npm run build` completed.
- Startup file is `app.js`.
- Application mode is Production.
- Application root is correct.
- The Node.js application was restarted.
- `.env.local` contains the correct values.

Look for a Passenger or application error log in cPanel.

Do not post logs publicly until passwords, tokens and secret values have been removed.

---

## 42. The Website Shows Old Content or Old Code

For code changes:

```bash
git pull origin main
npm install
npm run build
mkdir -p tmp
touch tmp/restart.txt
```

For WordPress content, clear any WordPress, CDN or application cache being used.

---

## 43. The Faust Secret Does Not Work

Return to:

```text
WordPress → Settings → Faust
```

Copy the current secret again and replace the value in `.env.local`.

Then rebuild and restart:

```bash
npm run build
mkdir -p tmp
touch tmp/restart.txt
```

Never commit the secret.

---

# Part L — First Launch Checklist

Before calling the setup complete, confirm every item:

- [ ] The WebSpace plan name contains `Premium`.
- [ ] Terminal is available in cPanel.
- [ ] Node.js Selector or Setup Node.js App is available.
- [ ] A separate client repository was created from the template.
- [ ] The client repository is private.
- [ ] WordPress is installed on the backend subdomain.
- [ ] HTTPS works on the frontend and backend.
- [ ] WPGraphQL is active.
- [ ] Faust.js is active.
- [ ] WordPress permalinks are not set to Plain.
- [ ] The GraphQL endpoint works.
- [ ] The Faust frontend URL is correct.
- [ ] `.env.local` contains the WordPress URL and Faust secret.
- [ ] `.env.local` is not tracked by Git.
- [ ] The GitHub deploy key is read-only.
- [ ] The cPanel application root is correct.
- [ ] The startup file is `app.js`.
- [ ] `npm install` completes successfully.
- [ ] `npm run generate` completes successfully.
- [ ] `npm run build` completes successfully.
- [ ] The Node.js application has been restarted.
- [ ] The frontend displays WordPress content.
- [ ] The project source is safely stored in GitHub.

---

# Support Information

When asking ReadySpace Support for help, provide:

```text
WebSpace plan name
cPanel username
Frontend domain
WordPress backend domain
Node.js version
Application root
Startup file
Exact error message
The step number from this README
```

Do not provide:

```text
cPanel password
WordPress password
Faust secret key
GitHub token
SSH private key
```

---

# Official References

- [Faust.js Basic Setup](https://faustjs.org/docs/how-to/basic-setup/)
- [Faust.js Self-Hosted Deployment](https://faustjs.org/docs/explanation/deploy-your-app/)
- [WPGraphQL Quick Start](https://www.wpgraphql.com/docs/quick-start)
- [cPanel Node.js Installation Guide](https://docs.cpanel.net/knowledge-base/general-server-administration/guide-to-node-js-installations/)
- [CloudLinux Node.js Selector](https://docs.cloudlinux.com/cloudlinuxos/lve_manager/)

---

## Template Maintainer Note

This template currently expects:

```text
Startup file: app.js
Package manager: npm
Build command: npm run build
GraphQL type command: npm run generate
Production mode: cPanel/CloudLinux Node.js application
```

Test template changes in a separate staging repository and WebSpace Premium account before using them for new client sites.
