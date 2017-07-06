import { NAMESPACE_PREFIX_MAP } from '../processing/dom/namespaces';

const ATTR_NAMESPACE_LOCAL_NAME_SEPARATOR = ':';

function getAttrName (attr) {
    return attr.prefix ?
           attr.prefix + ATTR_NAMESPACE_LOCAL_NAME_SEPARATOR + attr.name :
           attr.name;
}

function parseAttrName (attr) {
    const parts = attr.split(ATTR_NAMESPACE_LOCAL_NAME_SEPARATOR);

    if (parts.length === 2) {
        return {
            prefix: parts[0],
            name:   parts[1]
        };
    }

    return {
        name: parts[0]
    };
}

function findAttr (el, name) {
    for (let i = 0; i < el.attrs.length; i++) {
        if (getAttrName(el.attrs[i]) === name)
            return el.attrs[i];
    }
    return null;
}

export function createElement (tagName, attrs) {
    return {
        nodeName:   tagName,
        tagName:    tagName,
        attrs:      attrs,
        childNodes: []
    };
}

export function insertElement (el, parent) {
    el.namespaceURI = parent.namespaceURI;
    el.parentNode   = parent;
    parent.childNodes.unshift(el);
}

export function removeNode (node) {
    const parent  = node.parentNode;
    const elIndex = parent.childNodes.indexOf(node);

    parent.childNodes.splice(elIndex, 1);
}

export function findElementsByTagNames (root, tagNames) {
    const elements = {};

    walkElements(root, el => {
        if (tagNames.indexOf(el.tagName) !== -1) {
            elements[el.tagName] = elements[el.tagName] || [];
            elements[el.tagName].push(el);
        }
    });

    return elements;
}

export function walkElements (el, processor) {
    if (el.nodeName !== '#document' && el.nodeName !== '#text' && el.nodeName !== '#documentType' &&
        el.nodeName !== '#comment' && el.nodeName !== '#document-fragment')
        processor(el);

    if (el.childNodes)
        el.childNodes.forEach(child => walkElements(child, processor));
}

export function createTextNode (content, parent) {
    return {
        nodeName:   '#text',
        value:      content,
        parentNode: parent
    };
}

export function removeAttr (el, name) {
    for (let i = 0; i < el.attrs.length; i++) {
        if (getAttrName(el.attrs[i]) === name) {
            el.attrs.splice(i, 1);

            return;
        }
    }
}

export function getAttr (el, name) {
    const attr = findAttr(el, name);

    return attr ? attr.value : null;
}

export function setAttr (el, name, value) {
    const attr = findAttr(el, name);

    if (attr) {
        attr.value = value;

        return value;
    }

    const parsedAttrName = parseAttrName(name);
    const newAttr        = { name: parsedAttrName.name, value: value };

    if (parsedAttrName.prefix && NAMESPACE_PREFIX_MAP[parsedAttrName.prefix])
        newAttr.namespace = NAMESPACE_PREFIX_MAP[parsedAttrName.prefix];

    el.attrs.push(newAttr);

    return value;
}
