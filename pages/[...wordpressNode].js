import {
  getWordPressProps,
  WordPressTemplate,
} from "@faustwp/core";
import { getRankMathHead } from "../lib/rank-math";

export default function Page(props) {
  return <WordPressTemplate {...props} />;
}

export async function getStaticProps(ctx) {
  const wordpressProps = await getWordPressProps({
    ctx,
    revalidate: 30,
  });

  if (!wordpressProps.props) {
    return wordpressProps;
  }

  const rankMathHead = await getRankMathHead(ctx.params?.wordpressNode);

  return {
    ...wordpressProps,
    props: {
      ...wordpressProps.props,
      rankMathHead,
    },
  };
}

export async function getStaticPaths() {
  return {
    paths: [],
    fallback: "blocking",
  };
}
