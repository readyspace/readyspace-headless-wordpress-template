import { setConfig } from "@faustwp/core";
import templates from "./wp-templates";
import possibleTypes from "./possibleTypes.json";

export default setConfig({
  templates,
  plugins: [],
  possibleTypes,
});

