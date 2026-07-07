import { Config } from "@markdoc/markdoc";
import { citation } from "./citation";
import { fence } from "./code-block";
import { image } from "./image";
import { paragraph } from "./paragraph";

export const citationConfig: Config = {
  nodes: {
    paragraph,
    fence,
    image,
  },
  tags: {
    citation,
  },
};
