=== ReadySpace Headless WPGraphQL Bridge ===
Contributors: readyspace
Requires at least: 6.7
Requires PHP: 8.1
Stable tag: 1.0.0
License: GPL-3.0-or-later
License URI: https://www.gnu.org/licenses/gpl-3.0.html

Expose sanitized Rank Math output over WPGraphQL; sign frontend previews and
cache invalidation. See ../../docs/wordpress.md in the starter repository for
configuration, compatibility and the mandatory CMS integration acceptance gate.

No Rank Math or WPGraphQL code is bundled. Install and maintain those plugins
separately. This plugin does not send newsletters or enable WordPress REST APIs.

== Installation ==
1. Copy this directory to wp-content/plugins/readyspace-headless.
2. Install WPGraphQL, Rank Math SEO and PHP's DOM extension.
3. Activate in WordPress, configure wp-config.php using wp-config.example.php.
4. Run the staging acceptance matrix from docs/wordpress.md before production.

== License ==
Copyright (c) 2026 ReadySpace.
This plugin is free software: you can redistribute it and/or modify it under
the terms of the GNU General Public License as published by the Free Software
Foundation, either version 3 of the License, or (at your option) any later version.
This plugin is distributed in the hope that it will be useful, but WITHOUT ANY
WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR
A PARTICULAR PURPOSE. See LICENSE.txt for the full GNU General Public License.
