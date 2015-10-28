// -------------------------------------------------------------
// WARNING: this file is used by both the client and the server.
// Do not use any browser or node-specific API!
// -------------------------------------------------------------

import { createLocationGetWrapper } from '../ast';
import { Syntax } from '../parsing-tools';

// Transform:
// location.field; location[field] -->
// __get$Loc(location).field; __get$Loc(location)[field];

export default {
    nodeReplacementRequireTransform: false,

    nodeTypes: [Syntax.MemberExpression],

    condition: (node, parent) => {
        // Skip: for(location.field in obj)
        if (parent.type === Syntax.ForInStatement && parent.left === node)
            return false;

        return node.object.name === 'location';
    },

    run: node => {
        node.object = createLocationGetWrapper();
    }
};
