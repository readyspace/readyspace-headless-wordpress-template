import Head from "next/head";

const ATTRIBUTE_NAMES = {
  charset: "charSet",
  class: "className",
  crossorigin: "crossOrigin",
  "http-equiv": "httpEquiv",
  hreflang: "hrefLang",
  itemprop: "itemProp",
};

const ALLOWED_ATTRIBUTES = {
  link: new Set([
    "as",
    "crossOrigin",
    "href",
    "hrefLang",
    "media",
    "rel",
    "sizes",
    "type",
  ]),
  meta: new Set([
    "charSet",
    "content",
    "httpEquiv",
    "itemProp",
    "name",
    "property",
  ]),
  script: new Set(["className", "id", "type"]),
};

function decodeHtmlEntities(value) {
  const namedEntities = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: "\u00a0",
    quot: '"',
  };

  return value.replace(
    /&(#x[\da-f]+|#\d+|amp|apos|gt|lt|nbsp|quot);/gi,
    (entity, code) => {
      if (code[0] !== "#") {
        return namedEntities[code.toLowerCase()] || entity;
      }

      const radix = code[1].toLowerCase() === "x" ? 16 : 10;
      const number = Number.parseInt(code.slice(radix === 16 ? 2 : 1), radix);
      return Number.isFinite(number) && number >= 0 && number <= 0x10ffff
        ? String.fromCodePoint(number)
        : entity;
    },
  );
}

function parseAttributes(source, elementType) {
  const attributes = {};
  const attributePattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match;

  while ((match = attributePattern.exec(source)) !== null) {
    const rawName = match[1].toLowerCase();
    const name = ATTRIBUTE_NAMES[rawName] || rawName;

    if (!ALLOWED_ATTRIBUTES[elementType].has(name)) {
      continue;
    }

    const rawValue = match[2] ?? match[3] ?? match[4] ?? "";
    attributes[name] = decodeHtmlEntities(rawValue);
  }

  return attributes;
}

function parseRankMathHead(markup) {
  const elements = [];
  const title = markup.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);

  if (title) {
    elements.push(
      <title key="rank-math-title">{decodeHtmlEntities(title[1].trim())}</title>,
    );
  }

  for (const elementType of ["meta", "link"]) {
    const elementPattern = new RegExp(
      `<${elementType}\\b((?:"[^"]*"|'[^']*'|[^'">])*)>`,
      "gi",
    );
    let match;
    let index = 0;

    while ((match = elementPattern.exec(markup)) !== null) {
      const attributes = parseAttributes(match[1], elementType);
      const key = `rank-math-${elementType}-${index}`;
      elements.push(
        elementType === "meta" ? (
          <meta {...attributes} key={key} />
        ) : (
          <link {...attributes} key={key} />
        ),
      );
      index += 1;
    }
  }

  const scriptPattern =
    /<script\b((?:"[^"]*"|'[^']*'|[^'">])*)>([\s\S]*?)<\/script>/gi;
  let scriptMatch;
  let scriptIndex = 0;

  while ((scriptMatch = scriptPattern.exec(markup)) !== null) {
    const attributes = parseAttributes(scriptMatch[1], "script");

    if (attributes.type?.toLowerCase() !== "application/ld+json") {
      continue;
    }

    try {
      const structuredData = JSON.stringify(JSON.parse(scriptMatch[2])).replace(
        /</g,
        "\\u003c",
      );

      elements.push(
        <script
          {...attributes}
          dangerouslySetInnerHTML={{ __html: structuredData }}
          key={`rank-math-json-ld-${scriptIndex}`}
        />,
      );
      scriptIndex += 1;
    } catch (error) {
      console.warn(
        "Rank Math returned invalid JSON-LD; the schema tag was skipped.",
      );
    }
  }

  return elements;
}

export default function RankMathHead({ markup }) {
  if (!markup || typeof markup !== "string") {
    return null;
  }

  return <Head>{parseRankMathHead(markup)}</Head>;
}
