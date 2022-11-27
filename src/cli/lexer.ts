import moo from "moo";
const { compile } = moo;
import { OSCArgumentInputValue } from "../osc/types";

export const lexer = compile<OSCArgumentInputValue>({
  ws: /[ ]+/,
  address: /(?:\/[a-z0-9]+)+/,
  float: {
    match: /[+-]?(?:\d+\.\d*f?|\.\d+f?|[0-9]+f)/,
    value: (v) => ({ f: parseFloat(v) }),
  },
  int: { match: /[+-]?\d+/, value: (v) => ({ i: parseInt(v) }) },
  string: /"(?:\\["bfnrt\/\\]|\\u[a-fA-F0-9]{4}|[^"\\])*"/,
  command: { match: /:\w+/, value: (v) => v.slice(1) },
});
