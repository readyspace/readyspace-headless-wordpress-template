<?php
/** Paste into wp-config.php ABOVE the stop-editing line. Never commit real secrets. */
define( 'READYSPACE_HEADLESS_TARGETS', [
	[
		'name' => 'production',
		'origin' => 'https://example.com',
		'revalidate_secret' => 'REPLACE_WITH_32_OR_MORE_RANDOM_CHARACTERS',
		// Omit preview_secret to keep frontend previews disabled on production.
	],
	[
		'name' => 'staging',
		'origin' => 'https://staging.example.com',
		'revalidate_secret' => 'REPLACE_WITH_A_DIFFERENT_RANDOM_SECRET',
		'preview_secret' => 'REPLACE_WITH_A_DIFFERENT_RANDOM_SECRET',
	],
] );
define( 'READYSPACE_HEADLESS_PREVIEW_TARGET', 'staging' );
