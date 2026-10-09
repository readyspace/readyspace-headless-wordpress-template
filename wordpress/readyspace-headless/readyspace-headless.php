<?php
/**
 * Plugin Name: ReadySpace Headless WPGraphQL Bridge
 * Description: Published-only Rank Math GraphQL snapshots, signed previews and cache invalidation.
 * Version: 1.0.0
 * Requires at least: 6.7
 * Requires PHP: 8.1
 * License: GPL-3.0-or-later
 * License URI: https://www.gnu.org/licenses/gpl-3.0.html
 * Text Domain: readyspace-headless
 */
namespace ReadySpace\Headless;

defined( 'ABSPATH' ) || exit;

require_once __DIR__ . '/includes/class-seo.php';
require_once __DIR__ . '/includes/class-publication.php';

add_action( 'plugins_loaded', static function () {
	SEO::boot();
	Publication::boot();
} );

// Keep CMS copies out of indexes without changing Rank Math's editorial robots
// settings or the shared blog_public flag used to generate frontend metadata.
add_action( 'send_headers', static function () {
	if ( ! defined( 'READYSPACE_HEADLESS_CMS_NOINDEX' ) || READYSPACE_HEADLESS_CMS_NOINDEX ) {
		header( 'X-Robots-Tag: noindex, nofollow', true );
	}
} );

add_action( 'admin_notices', static function () {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	if ( ! function_exists( 'register_graphql_field' ) || ! defined( 'RANK_MATH_VERSION' ) || ! class_exists( '\DOMDocument' ) ) {
		echo '<div class="notice notice-error"><p>' . esc_html__( 'ReadySpace Headless requires WPGraphQL, Rank Math SEO and the PHP DOM extension. Frontend SEO readiness remains false until all dependencies are available.', 'readyspace-headless' ) . '</p></div>';
	}
	if ( get_option( 'readyspace_headless_webhook_failure' ) ) {
		echo '<div class="notice notice-warning"><p>' . esc_html__( 'ReadySpace Headless cache invalidation failed. Check WP-Cron and the configured frontend targets, then run the pending retry or revalidate manually before approving publication.', 'readyspace-headless' ) . '</p></div>';
	}
	if ( get_option( 'readyspace_headless_seo_warm_failure' ) ) {
		echo '<div class="notice notice-warning"><p>' . esc_html__( 'ReadySpace Headless could not refresh some SEO snapshots. Verify native CMS rendering and the frontend SEO readiness check before approving a release. The warning can be cleared after the affected URLs pass verification.', 'readyspace-headless' ) . '</p></div>';
	}
} );
