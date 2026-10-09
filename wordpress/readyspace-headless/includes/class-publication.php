<?php
namespace ReadySpace\Headless;

defined( 'ABSPATH' ) || exit;

final class Publication {
	private static $paths = [];
	private static $old_paths = [];
	private static $changed = false;

	public static function boot() {
		add_action( 'pre_post_update', static function ( $id ) {
			$post = get_post( $id );
			if ( SEO::public_post( $post ) ) {
				self::$old_paths[ $id ] = SEO::uri( get_permalink( $post ) );
			}
		} );
		add_action( 'wp_after_insert_post', [ __CLASS__, 'post_changed' ], 20, 4 );
		add_action( 'before_delete_post', static function ( $id, $post ) { self::post_changed( $id, $post ); }, 10, 2 );
		foreach ( [ 'added_post_meta', 'updated_post_meta', 'deleted_post_meta' ] as $hook ) {
			add_action( $hook, static function ( $meta_id, $post_id, $key ) {
				if ( 0 === strpos( $key, 'rank_math_' ) || in_array( $key, [ '_thumbnail_id', '_wp_page_template' ], true ) ) {
					self::post_changed( $post_id, get_post( $post_id ) );
				}
			}, 20, 3 );
		}
		foreach ( [ 'created_term', 'edited_term', 'delete_term', 'set_object_terms' ] as $hook ) {
			add_action( $hook, [ __CLASS__, 'all_changed' ], 20 );
		}
		foreach ( [ 'added_term_meta', 'updated_term_meta', 'deleted_term_meta' ] as $hook ) {
			add_action( $hook, static function ( $meta_id, $term_id, $key ) {
				if ( 0 === strpos( $key, 'rank_math_' ) ) {
					self::all_changed();
				}
			}, 20, 3 );
		}
		add_action( 'updated_option', static function ( $name ) {
			if ( 0 === strpos( $name, 'rank-math' ) || 0 === strpos( $name, 'rank_math' ) || in_array( $name, [ 'home', 'siteurl', 'blogname', 'blogdescription', 'permalink_structure', 'show_on_front', 'page_on_front', 'page_for_posts', 'posts_per_page' ], true ) ) {
				self::all_changed();
			}
		} );
		add_action( 'wp_update_nav_menu', [ __CLASS__, 'all_changed' ] );
		add_action( 'profile_update', [ __CLASS__, 'all_changed' ] );
		add_action( 'deleted_user', [ __CLASS__, 'all_changed' ] );
		foreach ( [ 'added_user_meta', 'updated_user_meta', 'deleted_user_meta' ] as $hook ) {
			add_action( $hook, static function ( $meta_id, $user_id, $key ) {
				if ( 0 === strpos( $key, 'rank_math_' ) || 'description' === $key ) {
					self::all_changed();
				}
			}, 20, 3 );
		}
		add_action( 'shutdown', [ __CLASS__, 'schedule' ] );
		add_action( 'readyspace_headless_revalidate', [ __CLASS__, 'send' ], 10, 2 );
		add_filter( 'preview_post_link', [ __CLASS__, 'preview_link' ], 20, 2 );
	}

	public static function post_changed( $id, $post, $update = false, $before = null ) {
		if ( ! $post instanceof \WP_Post || wp_is_post_revision( $id ) || wp_is_post_autosave( $id ) ) {
			return;
		}
		$was_public = $before instanceof \WP_Post && 'publish' === $before->post_status && '' === $before->post_password;
		if ( ! SEO::public_post( $post ) && ! $was_public && ! isset( self::$old_paths[ $id ] ) ) {
			return;
		}
		self::mark_changed();
		self::$paths[] = SEO::uri( get_permalink( $post ) );
		self::$paths[] = self::$old_paths[ $id ] ?? null;
		$post_type = get_post_type_object( $post->post_type );
		if ( $post_type && $post_type->has_archive ) {
			self::$paths[] = SEO::uri( get_post_type_archive_link( $post->post_type ) );
		}
		foreach ( get_object_taxonomies( $post->post_type ) as $taxonomy ) {
			$terms = wp_get_post_terms( $id, $taxonomy );
			if ( ! is_wp_error( $terms ) ) {
				foreach ( $terms as $term ) {
					if ( SEO::public_term( $term ) ) {
						self::$paths[] = SEO::uri( get_term_link( $term ) );
					}
				}
			}
		}
	}

	private static function mark_changed() {
		if ( ! self::$changed ) {
			SEO::invalidate();
		}
		self::$changed = true;
	}

	public static function all_changed() {
		self::mark_changed();
		// Every mutation invalidates the shared wordpress cache tag at the receiver;
		// / also signals layout/navigation/global metadata invalidation.
		self::$paths[] = '/';
	}

	public static function schedule() {
		if ( ! self::$changed ) {
			return;
		}
		// Clear any snapshot warmed concurrently before Rank Math's final metadata
		// writes completed; the webhook is scheduled only after this final epoch.
		SEO::invalidate();
		self::$paths[] = '/';
		$posts_page = get_post( (int) get_option( 'page_for_posts' ) );
		if ( SEO::public_post( $posts_page ) ) {
			self::$paths[] = SEO::uri( get_permalink( $posts_page ) );
		}
		$paths = array_values( array_unique( array_filter( self::$paths ) ) );
		SEO::queue_refresh( $paths, true );
		// Persist after all editorial metadata has been saved; never send newsletters.
		$args = [ $paths, 0 ];
		if ( ! wp_next_scheduled( 'readyspace_headless_revalidate', $args ) ) {
			wp_schedule_single_event( time() + 5, 'readyspace_headless_revalidate', $args );
		}
	}

	private static function targets() {
		return defined( 'READYSPACE_HEADLESS_TARGETS' ) && is_array( READYSPACE_HEADLESS_TARGETS ) ? READYSPACE_HEADLESS_TARGETS : [];
	}

	private static function target_origin( $target ) {
		$origin = $target['origin'] ?? '';
		$parts = wp_parse_url( $origin );
		if ( ! is_array( $parts ) || 'https' !== ( $parts['scheme'] ?? '' ) || empty( $parts['host'] ) || isset( $parts['user'] ) || isset( $parts['pass'] ) || isset( $parts['query'] ) || isset( $parts['fragment'] ) || ( isset( $parts['path'] ) && ! in_array( $parts['path'], [ '', '/' ], true ) ) ) {
			return null;
		}
		return rtrim( $origin, '/' );
	}

	public static function sign( $payload, $secret ) {
		return hash_hmac( 'sha256', $payload, $secret );
	}

	public static function revalidation_body( $paths ) {
		$body = wp_json_encode( [ 'paths' => $paths ] );
		// The receiver also invalidates the shared WordPress tag. A bounded /
		// notification therefore safely handles imports and large metadata edits.
		return count( $paths ) > 100 || ! is_string( $body ) || strlen( $body ) > 8000 ? wp_json_encode( [ 'paths' => [ '/' ] ] ) : $body;
	}

	public static function send( $paths, $attempt = 0 ) {
		$paths = array_values( array_unique( array_filter( array_map( [ SEO::class, 'uri' ], is_array( $paths ) ? $paths : [] ) ) ) );
		if ( ! $paths ) {
			return;
		}
		$body = self::revalidation_body( $paths );
		$failed = false;
		foreach ( self::targets() as $target ) {
			$origin = self::target_origin( $target );
			$secret = $target['revalidate_secret'] ?? '';
			if ( ! $origin || ! is_string( $secret ) || strlen( $secret ) < 32 ) {
				$failed = true;
				continue;
			}
			$timestamp = (string) time();
			$response = wp_safe_remote_post( $origin . '/api/revalidate', [
				'timeout' => 10,
				'redirection' => 0,
				'headers' => [ 'Content-Type' => 'application/json', 'x-readyspace-timestamp' => $timestamp, 'x-readyspace-signature' => self::sign( $timestamp . '.' . $body, $secret ) ],
				'body' => $body,
			] );
			$status = is_wp_error( $response ) ? 0 : wp_remote_retrieve_response_code( $response );
			if ( $status < 200 || $status >= 300 ) {
				$failed = true;
			}
		}
		if ( $failed ) {
			update_option( 'readyspace_headless_webhook_failure', gmdate( 'c' ), false );
			if ( $attempt < 3 ) {
				wp_schedule_single_event( time() + ( 30 * ( 2 ** $attempt ) ), 'readyspace_headless_revalidate', [ $paths, $attempt + 1 ] );
			}
		} else {
			delete_option( 'readyspace_headless_webhook_failure' );
		}
	}

	public static function preview_link( $link, $post ) {
		if ( ! $post instanceof \WP_Post || ! current_user_can( 'edit_post', $post->ID ) || '' !== $post->post_password ) {
			return $link;
		}
		$name = defined( 'READYSPACE_HEADLESS_PREVIEW_TARGET' ) ? READYSPACE_HEADLESS_PREVIEW_TARGET : 'staging';
		foreach ( self::targets() as $target ) {
			$secret = $target['preview_secret'] ?? '';
			$origin = self::target_origin( $target );
			if ( $name !== ( $target['name'] ?? '' ) || ! $origin || ! is_string( $secret ) || strlen( $secret ) < 32 ) {
				continue;
			}
			$path = SEO::uri( get_permalink( $post ) );
			if ( ! $path && function_exists( 'get_sample_permalink' ) ) {
				$sample = get_sample_permalink( $post->ID );
				$path = SEO::uri( str_replace( [ '%postname%', '%pagename%' ], $sample[1], $sample[0] ) );
			}
			if ( ! $path ) {
				return $link;
			}
			$claims = wp_json_encode( [ 'id' => $post->ID, 'path' => $path, 'exp' => time() + 300 ] );
			$encoded = rtrim( strtr( base64_encode( $claims ), '+/', '-_' ), '=' );
			$token = $encoded . '.' . self::sign( $encoded, $secret );
			return $origin . '/api/preview?token=' . rawurlencode( $token );
		}
		return $link;
	}
}
