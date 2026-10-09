<?php
/** Standalone contract tests. Run: php wordpress/readyspace-headless/tests/run.php */
define( 'ABSPATH', __DIR__ );
define( 'RANK_MATH_VERSION', 'test' );
define( 'HOUR_IN_SECONDS', 3600 );
class WP_Post {
	public $ID = 1;
	public $post_status = 'publish';
	public $post_password = '';
	public $post_type = 'post';
}
class WP_Term {
	public $term_id = 1;
	public $taxonomy = 'category';
}
class WP_Query {
	public $posts = [];
	public function __construct( $args ) { $this->posts = $GLOBALS['author_posts'][ $args['author'] ] ?? []; }
}
function wp_parse_url( $value ) { return parse_url( $value ); }
function get_option( $key, $default = false ) { return $GLOBALS['options'][ $key ] ?? $default; }
function update_option( $key, $value, $autoload = false ) { $GLOBALS['options'][ $key ] = $value; return true; }
function add_option( $key, $value, $unused = '', $autoload = false ) { if ( isset( $GLOBALS['options'][ $key ] ) ) { return false; } $GLOBALS['options'][ $key ] = $value; return true; }
function delete_option( $key ) { unset( $GLOBALS['options'][ $key ] ); }
function delete_transient( $key ) { unset( $GLOBALS['transients'][ $key ] ); }
function wp_next_scheduled( $event ) { return $GLOBALS['events'][ $event ] ?? false; }
function wp_schedule_single_event( $time, $event, $args = [] ) { $GLOBALS['events'][ $event ] = $time; }
function get_post_type_object( $type ) { return (object) [ 'public' => 'hidden' !== $type, 'publicly_queryable' => 'hidden' !== $type ]; }
function get_taxonomy( $type ) { return (object) [ 'public' => 'hidden' !== $type, 'publicly_queryable' => 'hidden' !== $type ]; }
function get_post( $id ) { return $GLOBALS['posts'][ $id ] ?? null; }
function get_term( $id ) { return $GLOBALS['terms'][ $id ] ?? null; }
function get_user_by( $field, $id ) { return $GLOBALS['users'][ $id ] ?? false; }
function get_post_types( $args ) { return [ 'post' => 'post', 'page' => 'page' ]; }
function get_transient( $key ) { return $GLOBALS['transients'][ $key ] ?? false; }
function home_url( $path ) { return 'https://cms.example.test' . $path; }
function wp_safe_remote_get( $url, $args ) { $GLOBALS['requests'][] = [ $url, $args ]; return []; }
function is_wp_error( $value ) { return false; }
function wp_remote_retrieve_response_code( $response ) { return $response['status'] ?? 200; }
function wp_remote_retrieve_header( $response, $name ) { return $response[ $name ] ?? ''; }
function wp_json_encode( $value, $options = 0 ) { return json_encode( $value, $options ); }
require_once dirname( __DIR__ ) . '/includes/class-seo.php';
require_once dirname( __DIR__ ) . '/includes/class-publication.php';
use ReadySpace\Headless\SEO;
use ReadySpace\Headless\Publication;
$count = 0;
function check( $condition, $message ) {
	++$GLOBALS['count'];
	if ( ! $condition ) {
		fwrite( STDERR, "FAIL: $message\n" );
		exit( 1 );
	}
}
check( '/2023/10/original-url/' === SEO::uri( '/2023/10/original-url/' ), 'Preserve dated path and trailing slash.' );
check( '/nested/page/' === SEO::uri( 'https://cms.example.test/nested/page/' ), 'Extract native permalink path.' );
foreach ( [ '', 'about/', '//evil.test/', '/foo/../secret/', '/foo/%2e%2e/secret/', '/foo%5cbar/', '/foo%00bar/', '/?p=1', '/wp-admin/', '/wp-json/anything', '/graphql/', '/%77p-admin/' ] as $path ) {
	check( null === SEO::uri( $path ), 'Reject unsafe or unsupported path: ' . $path );
}
check( '/category/news/page/2/' === SEO::redirect_uri( 'https://cms.example.test/category/news/page/2/', 'https://cms.example.test' ), 'Allow same-CMS canonical permalink redirect.' );
check( '/post/' === SEO::redirect_uri( '/post/', 'https://cms.example.test' ), 'Allow relative canonical permalink redirect.' );
foreach ( [ 'https://evil.test/post/', '//cms.example.test/post/', 'http://cms.example.test/post/', 'https://cms.example.test:444/post/', 'https://cms.example.test/wp-login.php', 'https://user:pass@cms.example.test/post/' ] as $location ) {
	check( null === SEO::redirect_uri( $location, 'https://cms.example.test' ), 'Reject unsafe redirect destination: ' . $location );
}
$post = new WP_Post();
check( SEO::public_post( $post ), 'Published public post accepted.' );
foreach ( [ 'draft', 'private', 'future', 'trash', 'inherit' ] as $status ) {
	$post->post_status = $status;
	check( ! SEO::public_post( $post ), 'Reject non-public post even if caller authenticated: ' . $status );
}
$post->post_status = 'publish';
$post->post_password = 'secret';
check( ! SEO::public_post( $post ), 'Password-protected metadata withheld.' );
$post->post_password = '';
$post->post_type = 'hidden';
check( ! SEO::public_post( $post ), 'Nonpublic post type withheld.' );
$term = new WP_Term();
check( SEO::public_term( $term ), 'Public taxonomy accepted.' );
$term->taxonomy = 'hidden';
check( ! SEO::public_term( $term ), 'Private taxonomy withheld.' );
$GLOBALS['users'][1] = (object) [ 'ID' => 1 ];
check( ! SEO::public_author( 1 ), 'Author without visible published posts withheld.' );
$GLOBALS['author_posts'][1] = [ 1 ];
check( SEO::public_author( 1 ), 'Author with public published content accepted.' );
check( ! SEO::public_author( 2 ), 'Missing author withheld.' );
$seo = SEO::parse_head( '<title>A &amp; B</title><meta name="description" content="Useful &amp; clear"><meta name="robots" content="noindex, follow, max-image-preview:large"><meta property="og:title" content="Social"><link rel="canonical" href="https://example.test/original/"><script type="application/ld+json">{"@context":"https://schema.org","name":"A & B"}</script><script>doEvil()</script>' );
check( $seo['ready'] && 'A & B' === $seo['title'] && 'Useful & clear' === $seo['description'], 'Rendered tags parsed and HTML entities decoded.' );
check( [ 'noindex', 'follow', 'max-image-preview:large' ] === $seo['robots'], 'Editorial robots directives retained.' );
check( 'https://example.test/original/' === $seo['canonical'], 'Editorial canonical retained.' );
check( 'Social' === $seo['openGraphTitle'], 'OpenGraph values exported.' );
check( 'A & B' === json_decode( $seo['jsonLd'], true )['name'], 'Valid JSON-LD exported.' );
check( false === strpos( json_encode( $seo ), 'doEvil' ), 'Executable head scripts never exported.' );
check( ! SEO::parse_head( '<title>Only title</title>' )['ready'], 'Incomplete rendered output fails readiness.' );
check( ! isset( SEO::parse_head( '<title>X</title><meta name="robots" content="index"><script type="application/ld+json">invalid</script>' )['jsonLd'] ), 'Invalid JSON-LD discarded.' );
$post->post_type = 'post';
$GLOBALS['posts'][1] = $post;
$cache_key = 'rs_headless_' . md5( '0:/original/' );
$GLOBALS['transients'][ $cache_key ] = [ 'context' => [ 'kind' => 'post', 'id' => 1 ], 'seo' => $seo ];
check( SEO::snapshot( '/original/' )['ready'], 'Published snapshot returns.' );
$post->post_status = 'draft';
check( ! SEO::snapshot( '/original/' )['ready'], 'Live publication status rechecked before cached metadata returns.' );
SEO::snapshot( 'https://foreign.example/uncached/' );
check( 'https://cms.example.test/uncached/' === $GLOBALS['requests'][0][0], 'Warm URL always fixed to CMS origin.' );
check( 0 === $GLOBALS['requests'][0][1]['redirection'] && [] === $GLOBALS['requests'][0][1]['cookies'], 'Warm request cannot follow redirects or carry credentials.' );
check( hash_hmac( 'sha256', '1700000000.{"paths":["/"]}', 'secret' ) === Publication::sign( '1700000000.{"paths":["/"]}', 'secret' ), 'Webhook signature matches exact timestamp/body contract.' );
check( [ 'paths' => [ '/' ] ] === json_decode( Publication::revalidation_body( array_fill( 0, 101, '/post/' ) ), true ), 'Bulk import webhook bounded to shared tag invalidation.' );
check( [ 'paths' => [ '/' ] ] === json_decode( Publication::revalidation_body( [ '/' . str_repeat( 'long-path/', 1000 ) ] ), true ), 'Oversized webhook bounded to receiver body limit.' );
check( [ 'paths' => [ '/old/', '/new/' ] ] === json_decode( Publication::revalidation_body( [ '/old/', '/new/' ] ), true ), 'Ordinary old/new permalink paths preserved.' );
$GLOBALS['options']['readyspace_headless_seo_uris'] = [ '/old/' => time() - 21 * HOUR_IN_SECONDS, '/fresh/' => time() ];
SEO::queue_refresh( [ '/new/' ], false );
$queue = $GLOBALS['options']['readyspace_headless_seo_queue'];
check( isset( $queue['/old/'], $queue['/new/'] ) && ! isset( $queue['/fresh/'] ), 'Renew old snapshots proactively and include newly published routes.' );
check( isset( $GLOBALS['events']['readyspace_headless_warm'] ), 'Background refresh scheduled automatically.' );
$GLOBALS['options']['readyspace_headless_seo_queue'] = array_fill_keys( [ '/a/', '/b/', '/c/', '/d/', '/e/' ], 0 );
$before_requests = count( $GLOBALS['requests'] );
SEO::warm_batch();
check( count( $GLOBALS['requests'] ) - $before_requests === 4, 'Cron warming bounded to four route operations.' );
check( 1 === $GLOBALS['options']['readyspace_headless_seo_queue']['/a/'] && 0 === $GLOBALS['options']['readyspace_headless_seo_queue']['/e/'], 'Unavailable snapshots retry while unprocessed work remains queued.' );
check( ! isset( $GLOBALS['options']['readyspace_headless_seo_warm_lock'] ), 'Cron lock released after warm batch.' );
echo "$count checks passed. WordPress/WPGraphQL/Rank Math integration still requires staging QA.\n";
