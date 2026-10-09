<?php
namespace ReadySpace\Headless;

defined( 'ABSPATH' ) || exit;

/**
 * Capture Rank Math's normal head in its native WordPress request context.
 * No private Rank Math APIs, reflection, frontend REST calls or executable head HTML.
 */
final class SEO {
	private static $capture_level = null;
	private static $context = null;
	private static $warming = [];
	private static $warm_count = 0;
	private static $warm_status = [];

	public static function boot() {
		add_action( 'graphql_register_types', [ __CLASS__, 'register_schema' ] );
		add_action( 'rank_math/head', [ __CLASS__, 'start_capture' ], -99999 );
		add_action( 'rank_math/head', [ __CLASS__, 'finish_capture' ], 99999 );
		add_action( 'readyspace_headless_warm', [ __CLASS__, 'warm_batch' ] );
		add_action( 'readyspace_headless_refresh', static function () { self::queue_refresh( [], false ); } );
		if ( ! wp_next_scheduled( 'readyspace_headless_refresh' ) ) {
			wp_schedule_event( time() + HOUR_IN_SECONDS, 'hourly', 'readyspace_headless_refresh' );
		}
	}

	public static function register_schema() {
		$fields = [
			'ready' => [ 'type' => [ 'non_null' => 'Boolean' ] ],
			'generatedAt' => [ 'type' => 'String' ],
			'robots' => [ 'type' => [ 'list_of' => 'String' ] ],
		];
		foreach ( [ 'title', 'description', 'canonical', 'openGraphTitle', 'openGraphDescription', 'openGraphImage', 'openGraphUrl', 'openGraphType', 'openGraphSiteName', 'twitterCard', 'twitterTitle', 'twitterDescription', 'twitterImage', 'jsonLd' ] as $field ) {
			$fields[ $field ] = [ 'type' => 'String' ];
		}
		register_graphql_object_type( 'ReadySpaceSeo', [ 'description' => 'Sanitized, published-only Rank Math output captured in a native CMS request. Check ready before release.', 'fields' => $fields ] );
		register_graphql_field( 'RootQuery', 'readyspaceSeo', [
			'type' => 'ReadySpaceSeo',
			'args' => [ 'uri' => [ 'type' => [ 'non_null' => 'String' ] ] ],
			'resolve' => static function ( $root, $args ) { return self::snapshot( $args['uri'] ); },
		] );
		register_graphql_field( 'RootQuery', 'readyspaceFrontPageSeo', [ 'type' => 'ReadySpaceSeo', 'resolve' => static function () { return self::snapshot( '/' ); } ] );
		foreach ( [ 'ContentNode', 'TermNode' ] as $type ) {
			register_graphql_field( $type, 'readyspaceSeo', [
				'type' => 'ReadySpaceSeo',
				'resolve' => static function ( $node ) use ( $type ) {
					$id = isset( $node->databaseId ) ? (int) $node->databaseId : 0;
					if ( 'ContentNode' === $type ) {
						$post = get_post( $id );
						return self::public_post( $post ) ? self::snapshot( self::uri( get_permalink( $post ) ) ) : [ 'ready' => false ];
					}
					$term = get_term( $id );
					return self::public_term( $term ) ? self::snapshot( self::uri( get_term_link( $term ) ) ) : [ 'ready' => false ];
				},
			] );
		}
		register_graphql_object_type( 'ReadySpaceSettings', [ 'fields' => [ 'frontPageUri' => [ 'type' => 'String' ], 'postsPageUri' => [ 'type' => 'String' ] ] ] );
		register_graphql_field( 'RootQuery', 'readyspaceSettings', [
			'type' => 'ReadySpaceSettings',
			'resolve' => static function () {
				$result = [ 'frontPageUri' => '/' ];
				$post = get_post( (int) get_option( 'page_for_posts' ) );
				$result['postsPageUri'] = self::public_post( $post ) ? self::uri( get_permalink( $post ) ) : null;
				return $result;
			},
		] );
	}

	public static function public_post( $post ) {
		if ( ! $post instanceof \WP_Post || 'publish' !== $post->post_status || '' !== $post->post_password ) {
			return false;
		}
		$type = get_post_type_object( $post->post_type );
		return $type && $type->public && $type->publicly_queryable;
	}

	public static function public_term( $term ) {
		if ( ! $term instanceof \WP_Term ) {
			return false;
		}
		$taxonomy = get_taxonomy( $term->taxonomy );
		return $taxonomy && $taxonomy->public && $taxonomy->publicly_queryable;
	}

	public static function public_author( $id ) {
		if ( ! get_user_by( 'id', (int) $id ) ) {
			return false;
		}
		$types = array_values( get_post_types( [ 'public' => true, 'publicly_queryable' => true ] ) );
		if ( ! $types ) {
			return false;
		}
		$query = new \WP_Query( [ 'author' => (int) $id, 'post_type' => $types, 'post_status' => 'publish', 'has_password' => false, 'posts_per_page' => 1, 'fields' => 'ids', 'no_found_rows' => true ] );
		return ! empty( $query->posts );
	}

	/** Accept only path permalinks; query-style URLs need site-specific routing. */
	public static function uri( $value ) {
		if ( ! is_string( $value ) || '' === $value || strlen( $value ) > 2048 ) {
			return null;
		}
		$parts = wp_parse_url( $value );
		if ( false === $parts || isset( $parts['query'] ) || isset( $parts['fragment'] ) || isset( $parts['user'] ) || isset( $parts['pass'] ) || ( isset( $parts['host'] ) && ! isset( $parts['scheme'] ) ) || ( isset( $parts['scheme'] ) && ! in_array( $parts['scheme'], [ 'https', 'http' ], true ) ) ) {
			return null;
		}
		$path = $parts['path'] ?? '/';
		$decoded = rawurldecode( $path );
		if ( '/' !== substr( $path, 0, 1 ) || false !== strpos( $decoded, '\\' ) || preg_match( '/[\x00-\x20\x7f]/', $decoded ) || preg_match( '#(^|/)\.{1,2}(/|$)#', $decoded ) || preg_match( '#^/(?:wp-admin|wp-login\.php|wp-json|graphql|xmlrpc\.php|wp-content|wp-includes)(?:/|$)#i', $decoded ) || 0 === strpos( $path, '//' ) ) {
			return null;
		}
		return $path;
	}

	private static function cache_key( $uri ) {
		return 'rs_headless_' . md5( get_option( 'readyspace_headless_seo_epoch', '0' ) . ':' . $uri );
	}

	/** Follow only a normal permalink redirect inside the configured CMS origin. */
	public static function redirect_uri( $location, $origin ) {
		$parts = wp_parse_url( $location );
		$home = wp_parse_url( $origin );
		if ( ! is_array( $parts ) || ! is_array( $home ) ) {
			return null;
		}
		if ( isset( $parts['host'] ) && ( ! isset( $parts['scheme'] ) || strtolower( $parts['host'] ) !== strtolower( $home['host'] ) || $parts['scheme'] !== $home['scheme'] || ( $parts['port'] ?? null ) !== ( $home['port'] ?? null ) ) ) {
			return null;
		}
		return self::uri( $location );
	}

	public static function invalidate() {
		update_option( 'readyspace_headless_seo_epoch', wp_generate_uuid4(), false );
	}

	private static function remember( $uri ) {
		$known = get_option( 'readyspace_headless_seo_uris', [] );
		$known = is_array( $known ) ? $known : [];
		unset( $known[ $uri ] );
		$known[ $uri ] = time();
		// Retain a bounded recent inventory. Larger sites can still lazily recover
		// through separate GraphQL requests and should use their audited URL warm job.
		update_option( 'readyspace_headless_seo_uris', array_slice( $known, -5000, null, true ), false );
	}

	public static function queue_refresh( $paths = [], $all = true ) {
		$known = get_option( 'readyspace_headless_seo_uris', [] );
		$queue = get_option( 'readyspace_headless_seo_queue', [] );
		$known = is_array( $known ) ? $known : [];
		$queue = is_array( $queue ) ? $queue : [];
		foreach ( $known as $uri => $captured ) {
			if ( $all || (int) $captured < time() - 20 * HOUR_IN_SECONDS ) {
				$paths[] = $uri;
			}
		}
		foreach ( $paths as $path ) {
			$uri = self::uri( $path );
			if ( $uri ) {
				$queue[ $uri ] = 0;
			}
		}
		if ( $queue ) {
			update_option( 'readyspace_headless_seo_queue', array_slice( $queue, 0, 5000, true ), false );
			if ( ! wp_next_scheduled( 'readyspace_headless_warm' ) ) {
				wp_schedule_single_event( time() + 10, 'readyspace_headless_warm' );
			}
		}
	}

	/** Four bounded warm operations per cron run; no production content writes. */
	public static function warm_batch() {
		$lock = 'readyspace_headless_seo_warm_lock';
		if ( ! add_option( $lock, time(), '', false ) ) {
			if ( (int) get_option( $lock ) < time() - 120 ) {
				delete_option( $lock );
			}
			wp_schedule_single_event( time() + 30, 'readyspace_headless_warm' );
			return;
		}
		try {
			$queue = get_option( 'readyspace_headless_seo_queue', [] );
			$batch = array_slice( is_array( $queue ) ? $queue : [], 0, 4, true );
			$failed = [];
			foreach ( $batch as $uri => $attempt ) {
				// Refresh proactively before one-day expiry, or after a new epoch.
				delete_transient( self::cache_key( $uri ) );
				self::$warming = [];
				self::$warm_count = 0;
				$seo = self::snapshot( $uri );
				if ( empty( $seo['ready'] ) && in_array( self::$warm_status[ $uri ] ?? 0, [ 404, 410 ], true ) ) {
					$known = get_option( 'readyspace_headless_seo_uris', [] );
					if ( is_array( $known ) ) {
						unset( $known[ $uri ] );
						update_option( 'readyspace_headless_seo_uris', $known, false );
					}
				} elseif ( empty( $seo['ready'] ) && $attempt < 2 ) {
					$failed[ $uri ] = $attempt + 1;
				} elseif ( empty( $seo['ready'] ) ) {
					update_option( 'readyspace_headless_seo_warm_failure', gmdate( 'c' ), false );
				}
			}
			// Merge new editorial work enqueued while this batch rendered.
			$remaining = get_option( 'readyspace_headless_seo_queue', [] );
			$remaining = is_array( $remaining ) ? $remaining : [];
			foreach ( $batch as $uri => $attempt ) {
				unset( $remaining[ $uri ] );
			}
			$remaining = array_merge( $remaining, $failed );
			update_option( 'readyspace_headless_seo_queue', $remaining, false );
			if ( $remaining ) {
				wp_schedule_single_event( time() + 10, 'readyspace_headless_warm' );
			} elseif ( $batch ) {
				// Initial withdrawal invalidation already ran; refresh again after
				// metadata warming so a transient readiness failure is not cached.
				Publication::send( [ '/' ] );
			}
		} finally {
			delete_option( $lock );
		}
	}

	private static function valid_context( $context ) {
		if ( ! is_array( $context ) ) {
			return false;
		}
		if ( 'post' === $context['kind'] ) {
			return self::public_post( get_post( $context['id'] ) );
		}
		if ( 'term' === $context['kind'] ) {
			return self::public_term( get_term( $context['id'] ) );
		}
		if ( 'author' === $context['kind'] ) {
			return self::public_author( $context['id'] );
		}
		if ( 'front' === $context['kind'] ) {
			return 'page' !== get_option( 'show_on_front' ) || self::public_post( get_post( (int) get_option( 'page_on_front' ) ) );
		}
		$type = get_post_type_object( $context['id'] );
		return 'archive' === $context['kind'] && $type && $type->public && $type->publicly_queryable;
	}

	public static function snapshot( $path ) {
		$uri = self::uri( $path );
		if ( null === $uri ) {
			return [ 'ready' => false ];
		}
		$key = self::cache_key( $uri );
		$record = get_transient( $key );
		if ( ! $record && ! isset( self::$warming[ $uri ] ) && self::$warm_count < 2 && defined( 'RANK_MATH_VERSION' ) && class_exists( '\DOMDocument' ) ) {
			// Only the configured CMS origin and a validated path; no auth or cookies,
			// no redirects, and never any Rank Math REST endpoint.
			self::$warming[ $uri ] = true;
			++self::$warm_count;
			$home = wp_parse_url( home_url( '/' ) );
			if ( isset( $home['scheme'], $home['host'] ) && in_array( $home['scheme'], [ 'https', 'http' ], true ) ) {
				$origin = $home['scheme'] . '://' . $home['host'] . ( isset( $home['port'] ) ? ':' . $home['port'] : '' );
				$options = [ 'timeout' => 8, 'redirection' => 0, 'cookies' => [], 'headers' => [ 'X-ReadySpace-SEO-Warm' => '1' ], 'limit_response_size' => 512000 ];
				$response = wp_safe_remote_get( $origin . $uri, $options );
				$status = is_wp_error( $response ) ? 0 : wp_remote_retrieve_response_code( $response );
				self::$warm_status[ $uri ] = $status;
				if ( in_array( $status, [ 301, 302, 307, 308 ], true ) && self::$warm_count < 2 ) {
					$canonical_uri = self::redirect_uri( wp_remote_retrieve_header( $response, 'location' ), $origin );
					if ( $canonical_uri && $canonical_uri !== $uri ) {
						++self::$warm_count;
						wp_safe_remote_get( $origin . $canonical_uri, $options );
						$canonical_record = get_transient( self::cache_key( $canonical_uri ) );
						if ( $canonical_record && self::valid_context( $canonical_record['context'] ) ) {
							set_transient( $key, $canonical_record, DAY_IN_SECONDS );
							self::remember( $uri );
						}
					}
				}
			}
			$record = get_transient( $key );
		}
		return $record && self::valid_context( $record['context'] ) ? $record['seo'] : [ 'ready' => false ];
	}

	public static function start_capture() {
		if ( null !== self::$capture_level || ! class_exists( '\DOMDocument' ) || is_user_logged_in() || is_preview() || is_404() || is_search() || is_feed() ) {
			return;
		}
		$object = get_queried_object();
		if ( is_front_page() ) {
			$context = [ 'kind' => 'front', 'id' => 0 ];
		} elseif ( is_singular() || ( is_home() && $object instanceof \WP_Post ) ) {
			$context = [ 'kind' => 'post', 'id' => $object->ID ?? 0 ];
		} elseif ( is_tax() || is_category() || is_tag() ) {
			$context = [ 'kind' => 'term', 'id' => $object->term_id ?? 0 ];
		} elseif ( is_author() ) {
			$context = [ 'kind' => 'author', 'id' => $object->ID ?? 0 ];
		} elseif ( is_post_type_archive() ) {
			$context = [ 'kind' => 'archive', 'id' => $object->name ?? '' ];
		} else {
			return;
		}
		if ( ! self::valid_context( $context ) ) {
			return;
		}
		$uri = self::uri( wp_unslash( $_SERVER['REQUEST_URI'] ?? '/' ) );
		if ( null === $uri ) {
			return;
		}
		self::$context = [ 'source' => $context, 'uri' => $uri ];
		ob_start();
		self::$capture_level = ob_get_level();
	}

	public static function finish_capture() {
		if ( null === self::$capture_level || ob_get_level() !== self::$capture_level ) {
			return;
		}
		$html = ob_get_clean();
		// Preserve the CMS's normal HTML unchanged; only parsed structured data is exposed.
		echo $html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
		$seo = self::parse_head( $html );
		if ( empty( $seo['title'] ) ) {
			// Some CMS themes omit title-tag support. Rank Math filters this core API
			// in the same native request; do not read or expand raw meta ourselves.
			$seo['title'] = html_entity_decode( wp_get_document_title(), ENT_QUOTES | ENT_HTML5, 'UTF-8' );
			$seo['ready'] = ! empty( $seo['title'] ) && ! empty( $seo['robots'] );
		}
		if ( $seo['ready'] ) {
			set_transient( self::cache_key( self::$context['uri'] ), [ 'context' => self::$context['source'], 'seo' => $seo ], DAY_IN_SECONDS );
			self::remember( self::$context['uri'] );
		}
		self::$capture_level = null;
		self::$context = null;
	}

	/** Export structured, decoded values, never arbitrary markup or scripts. */
	public static function parse_head( $html ) {
		$previous = libxml_use_internal_errors( true );
		$dom = new \DOMDocument();
		$dom->loadHTML( '<?xml encoding="utf-8" ?><html><head>' . $html . '</head><body></body></html>', LIBXML_NONET | LIBXML_NOERROR | LIBXML_NOWARNING );
		libxml_clear_errors();
		libxml_use_internal_errors( $previous );
		$seo = [ 'ready' => false, 'generatedAt' => gmdate( 'c' ), 'robots' => [] ];
		$title = $dom->getElementsByTagName( 'title' )->item( 0 );
		if ( $title ) {
			$seo['title'] = trim( $title->textContent );
		}
		$map = [ 'description' => 'description', 'og:title' => 'openGraphTitle', 'og:description' => 'openGraphDescription', 'og:image' => 'openGraphImage', 'og:url' => 'openGraphUrl', 'og:type' => 'openGraphType', 'og:site_name' => 'openGraphSiteName', 'twitter:card' => 'twitterCard', 'twitter:title' => 'twitterTitle', 'twitter:description' => 'twitterDescription', 'twitter:image' => 'twitterImage' ];
		foreach ( $dom->getElementsByTagName( 'meta' ) as $meta ) {
			$name = strtolower( $meta->getAttribute( 'name' ) ?: $meta->getAttribute( 'property' ) );
			$content = $meta->getAttribute( 'content' );
			if ( 'robots' === $name ) {
				$seo['robots'] = array_values( array_filter( array_map( 'trim', explode( ',', $content ) ) ) );
			} elseif ( isset( $map[ $name ] ) && ! isset( $seo[ $map[ $name ] ] ) ) {
				$seo[ $map[ $name ] ] = $content;
			}
		}
		foreach ( $dom->getElementsByTagName( 'link' ) as $link ) {
			if ( 'canonical' === strtolower( $link->getAttribute( 'rel' ) ) ) {
				$seo['canonical'] = $link->getAttribute( 'href' );
			}
		}
		$graphs = [];
		foreach ( $dom->getElementsByTagName( 'script' ) as $script ) {
			if ( 'application/ld+json' !== strtolower( $script->getAttribute( 'type' ) ) ) {
				continue;
			}
			$data = json_decode( $script->textContent, true );
			if ( is_array( $data ) && JSON_ERROR_NONE === json_last_error() ) {
				$graphs[] = $data;
			}
		}
		if ( $graphs ) {
			$seo['jsonLd'] = wp_json_encode( 1 === count( $graphs ) ? $graphs[0] : $graphs, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT );
		}
		$seo['ready'] = ! empty( $seo['title'] ) && ! empty( $seo['robots'] );
		return $seo;
	}
}
